import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.eaf45e87f3a44ef4acf8d77cfcb7710e',
  appName: 'cognisync-terrain-weaver',
  webDir: 'dist',
  server: {
    url: 'https://eaf45e87-f3a4-4ef4-acf8-d77cfcb7710e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    }
  }
};

export default config;