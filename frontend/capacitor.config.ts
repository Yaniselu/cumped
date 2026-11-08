import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.velosyntech.cumped',
  appName: 'Cumped',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: { overlaysWebView: false },
  },
};

export default config;
