const os = require('os');
const { execSync } = require('child_process');

const PORT = 8083;
let ip = '192.168.1.1';
const nets = os.networkInterfaces();
for (const name of Object.keys(nets || {})) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      ip = net.address;
      break;
    }
  }
  if (ip !== '192.168.1.1') break;
}
const expoUrl = `exp://${ip}:${PORT}`;
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(expoUrl)}`;
console.log('Expo adresi:', expoUrl);
console.log('QR kodu tarayicida aciliyor...');
if (process.platform === 'win32') {
  execSync(`start "" "${qrUrl}"`, { shell: true, stdio: 'ignore' });
} else {
  const open = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execSync(`${open} "${qrUrl}"`, { shell: true, stdio: 'ignore' });
}
