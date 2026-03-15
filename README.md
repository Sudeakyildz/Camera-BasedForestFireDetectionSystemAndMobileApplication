# Kamera Tabanlı Yangın Tespit Sistemi ve Mobil Uygulama

Kamera görüntüsünden **yangın tespiti** yapan sistem ve **mobil uygulama**. YOLO ve Mask R-CNN modelleri ile çalışır.

---

## Özellikler

- **YOLO (YOLOv8)** ile gerçek zamanlı yangın tespiti (webcam / video)
- **Mask R-CNN** ile yangın tespiti ve segmentasyon
- **Masaüstü arayüz:** Görsel, video veya webcam; yangında sesli uyarı
- **Mobil uygulama (Expo):** Sunucuya bağlanma, canlı durum, yangın alarmı, FCM push bildirim
- **Flask API:** `/status`, `/frame`, `/ack`, `/register_push_token`

---

## Proje Yapısı

| Klasör | Açıklama |
|--------|----------|
| **YOLO/** | YOLO modeli, eğitim scriptleri, sunucu (`local_inference.py`) |
| **MASKRCNN/** | Mask R-CNN eğitim, masaüstü uygulama, mobil sunucu |
| **mobile/** | Expo / React Native mobil uygulama |
| **projeparçaları/** | Raporlar, yardımcı scriptler |

---

## Kurulum

### YOLO sunucusu (mobil için)

```bash
cd YOLO
pip install -r requirements.txt
python local_inference.py --server --port 8000
```

Mobil uygulamada: `http://BILGISAYAR_IP:8000`

### Mask R-CNN sunucusu (mobil için)

```bash
cd MASKRCNN
pip install -r requirements.txt
python server_mobile.py --port 8001
```

Mobil uygulamada: `http://BILGISAYAR_IP:8001`

### Mask R-CNN masaüstü uygulaması

```bash
cd MASKRCNN
python fire_detection_app.py
```

Görsel yükle, video yükle veya kamerayı aç; yangın tespitinde uyarı ve ses çalar.

### Mobil uygulama

```bash
cd mobile
npm install
npx expo start
```

APK: `npm run build:apk`

---

## Model dosyaları

Ağır model dosyaları (`.pth`, `.pt`, `weights/`, `epoch/`) `.gitignore` ile repoda yok. YOLO için `YOLO/forest_fire_detection/weights/best.pt`, Mask R-CNN için `MASKRCNN/epoch/` veya eğitim çıktısındaki `.pth` dosyalarını kullanın veya kendiniz eğitin.

---

## API (mobil uygulama)

| Endpoint | Açıklama |
|----------|----------|
| `GET /status` | Yangın durumu, son güncelleme |
| `GET /frame` | Son işlenmiş kare |
| `POST /ack` | Alarm onayı |
| `POST /register_push_token` | FCM token kaydı |

---

Bitirme projesi kapsamında geliştirilmiştir.
