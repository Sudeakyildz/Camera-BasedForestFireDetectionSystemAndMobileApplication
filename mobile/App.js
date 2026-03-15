import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Alert,
  Linking,
  Platform,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const STORAGE_KEYS = {
  YOLO_URL: '@fire_app_yolo_url',
  MASKRCNN_URL: '@fire_app_maskrcnn_url',
  MODEL: '@fire_app_model',
};

// Bilgisayarinizin yerel WiFi IP'sini girin (CMD: ipconfig). Ornek: 192.168.1.10
const DEFAULT_YOLO_URL = 'http://192.168.1.1:8000';
const DEFAULT_MASKRCNN_URL = 'http://192.168.1.1:8001';
const DEFAULT_MODEL = 'yolo';

const appStateRef = { current: AppState.currentState };
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [coords, setCoords] = useState(null);
  const [stations, setStations] = useState([]);
  const [showLive, setShowLive] = useState(false);

  // Birleşik ayarlar: model tipi + sunucu URL'leri
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [yoloUrl, setYoloUrl] = useState(DEFAULT_YOLO_URL);
  const [maskRcnnUrl, setMaskRcnnUrl] = useState(DEFAULT_MASKRCNN_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const getHost = () => {
    const url = model === 'yolo' ? yoloUrl : maskRcnnUrl;
    return url.replace(/\/$/, '');
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedYolo, savedMask, savedModel] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.YOLO_URL),
          AsyncStorage.getItem(STORAGE_KEYS.MASKRCNN_URL),
          AsyncStorage.getItem(STORAGE_KEYS.MODEL),
        ]);
        if (savedYolo) setYoloUrl(savedYolo);
        if (savedMask) setMaskRcnnUrl(savedMask);
        if (savedModel === 'yolo' || savedModel === 'maskrcnn') setModel(savedModel);
      } catch (e) {}
      setSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  const saveSettings = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.YOLO_URL, yoloUrl),
        AsyncStorage.setItem(STORAGE_KEYS.MASKRCNN_URL, maskRcnnUrl),
        AsyncStorage.setItem(STORAGE_KEYS.MODEL, model),
      ]);
      setShowSettings(false);
    } catch (e) {
      Alert.alert('Hata', 'Ayarlar kaydedilemedi.');
    }
  };

  // Bildirime tiklaninca canli yayin ekranina gec
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.openLive) setShowLive(true);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification?.request?.content?.data?.openLive) setShowLive(true);
    });
    let unsub;
    try {
      const firebaseMessaging = require('@react-native-firebase/messaging').default;
      firebaseMessaging().getInitialNotification().then((msg) => {
        if (msg?.data?.openLive === 'true') setShowLive(true);
      });
      unsub = firebaseMessaging().onNotificationOpenedApp((msg) => {
        if (msg?.data?.openLive === 'true') setShowLive(true);
      });
    } catch (e) {}
    return () => { try { if (typeof unsub === 'function') unsub(); } catch (e) {} };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => sub?.remove();
  }, []);

  // Bildirim izni: uygulama acilir acilmaz iste (yangin uyarisi icin zorunlu)
  useEffect(() => {
    const askNotification = async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Bildirim izni gerekli',
          'Yangın tespit edildiğinde uyarı almak için lütfen bildirim iznini verin. Ayarlar > Uygulamalar üzerinden açabilirsiniz.',
          [{ text: 'Tamam' }]
        );
      }
    };
    askNotification();
  }, []);

  const lastNotifiedFireRef = useRef(null);
  const lastFireDetectedAtRef = useRef(0);

  const registerPushToken = React.useCallback(async () => {
    const host = model === 'yolo' ? yoloUrl.replace(/\/$/, '') : maskRcnnUrl.replace(/\/$/, '');
    const { status: perm } = await Notifications.getPermissionsAsync();
    if (perm !== 'granted') return;
    const payload = {};
    try {
      const firebaseMessaging = require('@react-native-firebase/messaging').default;
      const fcmToken = await firebaseMessaging().getToken();
      if (fcmToken) payload.fcm_token = fcmToken;
    } catch (e) {}
    if (!payload.fcm_token) {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
        if (tokenData?.data) payload.token = tokenData.data;
      } catch (e) {}
    }
    if (!payload.fcm_token && !payload.token) return;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`${host}/register_push_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) break;
      } catch (e) {}
      if (i < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }, [model, yoloUrl, maskRcnnUrl]);

  useEffect(() => {
    if (!settingsLoaded) return;
    (async () => {
      await registerPushToken();
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch (e) {}
      }
    })();
    const statusTimer = setInterval(async () => {
      try {
        const host = model === 'yolo' ? yoloUrl.replace(/\/$/, '') : maskRcnnUrl.replace(/\/$/, '');
        const r = await fetch(`${host}/status`);
        const j = await r.json();
        const ev = j?.last_event || null;
        setStatus(ev);
        if (ev?.type === 'fire_detected') lastFireDetectedAtRef.current = Date.now();
        if (ev?.type === 'fire_detected') {
          if (lastNotifiedFireRef.current !== 'fire') {
            lastNotifiedFireRef.current = 'fire';
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Yangın Uyarısı',
                  body: 'Yangın tespit edildi. Canlı yayını kontrol edin.',
                  sound: 'default',
                  data: { openLive: true },
                },
                trigger: null,
              });
            } catch (e) {}
          }
        }
        if (ev?.type === 'fire_cleared') lastNotifiedFireRef.current = null;
      } catch (e) {}
    }, 1000);
    return () => clearInterval(statusTimer);
  }, [settingsLoaded, model, yoloUrl, maskRcnnUrl, registerPushToken]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        registerPushToken();
      }
    });
    return () => sub?.remove();
  }, [registerPushToken]);

  // Canli yayin: sunucudaki /live sayfasi MJPEG video akisi (kamera gibi)

  const fetchStations = async () => {
    if (!coords) {
      Alert.alert('Konum yok', 'Konum iznini verin ve tekrar deneyin.');
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=fire%20station&limit=10&addressdetails=1&bounded=1&circle=${coords.lng},${coords.lat},50000`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'tr' } });
      const arr = await r.json();
      const enriched = arr
        .map((it) => {
          const lat = parseFloat(it.lat),
            lon = parseFloat(it.lon);
          const dist = haversine(coords.lat, coords.lng, lat, lon);
          return { name: it.display_name, lat, lon, dist };
        })
        .sort((a, b) => a.dist - b.dist);
      setStations(enriched);
    } catch (e) {
      Alert.alert('Arama hatası', 'İtfaiye araması başarısız oldu.');
    }
  };

  const openMaps = (lat, lon) => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    });
    Linking.openURL(url);
  };

  const callEmergency = () => {
    Linking.openURL('tel:112');
  };

  const modelLabel = model === 'yolo' ? 'YOLO' : 'Mask R-CNN';

  if (showSettings) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Ayarlar</Text>
          <Text style={styles.settingsSubtitle}>Sunucu ve model</Text>
          <View style={styles.settingsHeaderBtns}>
            <TouchableOpacity style={styles.settingsCancelBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.settingsCancelBtnText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsSaveBtn} onPress={saveSettings}>
              <Text style={styles.settingsSaveBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
          <Text style={styles.settingsSection}>Aktif model</Text>
          <View style={styles.modelRow}>
            <TouchableOpacity
              style={[styles.modelBtn, model === 'yolo' && styles.modelBtnActive]}
              onPress={() => setModel('yolo')}
            >
              <Text style={styles.modelBtnText}>YOLO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modelBtn, model === 'maskrcnn' && styles.modelBtnActive]}
              onPress={() => setModel('maskrcnn')}
            >
              <Text style={styles.modelBtnText}>Mask R-CNN</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingsSection}>YOLO sunucu adresi</Text>
          <TextInput
            style={styles.input}
            value={yoloUrl}
            onChangeText={setYoloUrl}
            placeholder="http://192.168.1.10:8000"
            placeholderTextColor="#6e7681"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.settingsSection}>Mask R-CNN sunucu adresi</Text>
          <TextInput
            style={styles.input}
            value={maskRcnnUrl}
            onChangeText={setMaskRcnnUrl}
            placeholder="http://192.168.1.10:8001"
            placeholderTextColor="#6e7681"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.settingsHint}>
            Bilgisayar IP'sini (ipconfig) girip portu ekleyin. Aynı WiFi'de olun.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showLive) {
    const liveUrl = `${getHost()}/live`;
    return (
      <SafeAreaView style={styles.liveContainer}>
        <StatusBar style="light" />
        <View style={styles.liveHeader}>
          <View>
            <Text style={styles.liveTitle}>Canlı Yayın</Text>
            <Text style={styles.liveSubtitle}>{modelLabel}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLive(false)}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: liveUrl }}
          style={styles.liveImage}
          scalesPageToFit
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          javaScriptEnabled
          allowsInlineMediaPlayback
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Yangın Tespit</Text>
        <Text style={styles.subtitle}>Canlı izleme ve alarm</Text>
        <View style={styles.headerRow}>
          <View style={[styles.badge, model === 'yolo' ? styles.badgeYolo : styles.badgeMask]}>
            <Text style={styles.badgeText}>{modelLabel}</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Text style={styles.settingsBtnText}>Ayarlar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusIndicator, (status?.type === 'fire_detected' || (status?.type === 'fire_cleared' && Date.now() - lastFireDetectedAtRef.current < 3000)) ? styles.statusAlarm : styles.statusOk]} />
        <Text style={styles.statusLabel}>Sistem durumu</Text>
        <Text style={[styles.statusValue, (status?.type === 'fire_detected' || (status?.type === 'fire_cleared' && Date.now() - lastFireDetectedAtRef.current < 3000)) && styles.statusValueAlarm]}>
          {(status?.type === 'fire_detected' || (status?.type === 'fire_cleared' && Date.now() - lastFireDetectedAtRef.current < 3000)) ? 'Yangın tespit edildi' : 'Bekleniyor'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLive(true)} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>Canlı Yayın</Text>
          <Text style={styles.primaryBtnHint}>Kamera görüntüsünü aç</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emergencyBtn} onPress={callEmergency} activeOpacity={0.8}>
          <Text style={styles.emergencyBtnText}>112 Acil Ara</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  title: {
    color: '#f0f6fc',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 14,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeYolo: {
    backgroundColor: '#238636',
  },
  badgeMask: {
    backgroundColor: '#1f6feb',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  settingsBtnText: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: '500',
  },
  statusCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusOk: {
    backgroundColor: '#3fb950',
  },
  statusAlarm: {
    backgroundColor: '#f85149',
  },
  statusLabel: {
    color: '#8b949e',
    fontSize: 13,
    flex: 1,
  },
  statusValue: {
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: '600',
  },
  statusValueAlarm: {
    color: '#f85149',
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 24,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#1f6feb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  primaryBtnHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  emergencyBtn: {
    backgroundColor: '#da3633',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emergencyBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  settingsSection: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  settingsHint: {
    color: '#6e7681',
    fontSize: 13,
    marginTop: 16,
    lineHeight: 20,
  },
  modelRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: '#21262d',
  },
  modelBtnActive: {
    backgroundColor: '#1f6feb',
  },
  modelBtnText: {
    color: '#c9d1d9',
    fontWeight: '600',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#c9d1d9',
    fontSize: 16,
  },
  liveContainer: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  liveTitle: {
    color: '#f0f6fc',
    fontSize: 20,
    fontWeight: '600',
  },
  liveSubtitle: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  closeBtnText: {
    color: '#8b949e',
    fontSize: 15,
    fontWeight: '500',
  },
  liveImage: {
    flex: 1,
  },
  settingsHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  settingsTitle: {
    color: '#f0f6fc',
    fontSize: 22,
    fontWeight: '700',
  },
  settingsSubtitle: {
    color: '#8b949e',
    fontSize: 14,
    marginTop: 4,
  },
  settingsHeaderBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  settingsCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  settingsCancelBtnText: {
    color: '#8b949e',
    fontSize: 15,
  },
  settingsSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#238636',
  },
  settingsSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
