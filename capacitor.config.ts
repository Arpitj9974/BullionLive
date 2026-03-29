import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arpit.bullionlive',
  appName: 'AR-AuAgPt',
  webDir: 'dist',
  server: {
    url: 'https://ar-auagpt.onrender.com',
    cleartext: true
  }
};

export default config;
