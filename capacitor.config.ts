import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mysetlists.app',
  appName: 'MySetlists',
  webDir: 'out',

  ios: {
    scheme: 'mysetlists',
    backgroundColor: '#0f172a',
  },

  server: {
    // Allow navigation to these domains for OAuth and external services
    allowNavigation: [
      'accounts.spotify.com',
      'accounts.google.com',
      '*.firebaseapp.com',
      'js-cdn.music.apple.com',
      'mysetlists.net',
    ],
  },

  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    StatusBar: {
      style: 'dark',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
