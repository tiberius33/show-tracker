/**
 * Camera and photo-library permissions on iOS.
 *
 * ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────
 *
 * TicketScanner asked for both permissions at once:
 *
 *     CapCamera.requestPermissions({ permissions: ['camera', 'photos'] })
 *
 * with a comment claiming that was the fix for the prompt never appearing.
 * It was the cause. @capacitor/camera's CameraPlugin.swift loops the
 * requested permissions into a DispatchGroup and fires
 * AVCaptureDevice.requestAccess and PHPhotoLibrary.requestAuthorization
 * CONCURRENTLY, from two threads. iOS presents one system alert per
 * window, so the second request races the first and the camera alert is
 * dropped — the prompt never appears, and getPhoto() then fails against a
 * permission the user was never asked for.
 *
 * The second defect was the check that followed it:
 *
 *     if (perms.camera === 'denied')
 *
 * CameraPermissionState is 'prompt' | 'prompt-with-rationale' | 'granted'
 * | 'denied' | 'limited'. Only one of the four failure-ish states was
 * handled, `photos` was never checked at all, and a user with the camera
 * granted but the library denied got "Camera error: …" — a message naming
 * the wrong device and offering no way out.
 *
 * ── WHAT THIS DOES INSTEAD ──────────────────────────────────────────────
 *
 * One permission at a time, requested at the moment the user asks for
 * that specific thing — which is also what Guideline 5.1.1 means by
 * asking in context. The caller decides whether the user wants the camera
 * or the library BEFORE anything is requested, so there is never a second
 * prompt in flight.
 *
 * 'limited' counts as granted. It is what iOS returns when the user
 * picked "Select Photos…" rather than granting the whole library, and the
 * picker works perfectly well with it — treating it as a denial would
 * send someone to Settings to fix something that is not broken.
 */

export const PERMISSION_KIND = { CAMERA: 'camera', PHOTOS: 'photos' };

/**
 * Ask for exactly one permission.
 *
 * @returns {Promise<{ ok: boolean, state?: string, blocked?: boolean, message?: string }>}
 *   `blocked` is the case that needs the Settings path: the user has
 *   refused before, so iOS will not show a prompt again and nothing the
 *   app does in-process can change it.
 */
export async function requestNativePermission(kind) {
  try {
    const { Camera } = await import('@capacitor/camera');

    // Check before requesting. A permission already decided does not need
    // a request, and requesting one that was refused returns immediately
    // with no prompt — which is exactly the state that needs Settings.
    const current = await Camera.checkPermissions();
    let state = current?.[kind];

    if (state === 'prompt' || state === 'prompt-with-rationale' || !state) {
      const result = await Camera.requestPermissions({ permissions: [kind] });
      state = result?.[kind];
    }

    // 'limited' is a partial photo-library grant, and the picker works
    // with it. Only the library ever reports it.
    if (state === 'granted' || state === 'limited') {
      return { ok: true, state };
    }

    return {
      ok: false,
      state,
      blocked: state === 'denied',
      message: kind === PERMISSION_KIND.CAMERA
        ? 'MySetlists doesn’t have access to your camera.'
        : 'MySetlists doesn’t have access to your photos.',
    };
  } catch (err) {
    console.error('[permissions] Request failed:', err);
    return {
      ok: false,
      state: 'error',
      blocked: false,
      message: 'Couldn’t check permissions. Please try again.',
    };
  }
}

/**
 * Open this app's page in the iOS Settings app.
 *
 * `app-settings:` rather than a plugin call: @capacitor/app has no
 * openUrl, and Capacitor's WKWebView navigation handler already passes a
 * scheme it does not recognise to UIApplication.open — the same path that
 * makes tel: and mailto: links work. Adding a plugin for one URL would be
 * native surface this build does not need.
 */
export function openAppSettings() {
  try {
    window.location.href = 'app-settings:';
    return true;
  } catch (err) {
    console.error('[permissions] Could not open Settings:', err);
    return false;
  }
}
