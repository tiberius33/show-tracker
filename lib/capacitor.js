/**
 * Capacitor native plugin initialization.
 *
 * Called once on app mount to configure StatusBar, Keyboard, and
 * other native-only features. No-ops gracefully on web.
 */

let initialized = false;

export async function initCapacitorPlugins() {
  if (initialized) return;
  initialized = true;

  let isNative = false;
  try {
    const { Capacitor } = require('@capacitor/core');
    isNative = Capacitor.isNativePlatform();
  } catch {
    return; // Not in a Capacitor environment
  }

  if (!isNative) return;

  // --- StatusBar: dark content on dark background ---
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    // Make status bar overlay the WebView (content renders behind it)
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch (e) {
    console.warn('StatusBar plugin not available:', e.message);
  }

  // --- Keyboard: track height via CSS custom property ---
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });
  } catch (e) {
    console.warn('Keyboard plugin not available:', e.message);
  }

  // --- SplashScreen: auto-hide after app is ready ---
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('SplashScreen plugin not available:', e.message);
  }
}
