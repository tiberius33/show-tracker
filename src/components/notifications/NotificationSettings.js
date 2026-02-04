import { useState, useEffect } from 'react';
import { Bell, BellOff, Check, AlertCircle } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, requestNotificationPermission } from '../../firebase';

export default function NotificationSettings({ userId }) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [loading, setLoading] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [preferences, setPreferences] = useState({
    showReminders: true,
    newFeatures: true,
    communityUpdates: false
  });

  useEffect(() => {
    // Load user notification preferences
    const loadPreferences = async () => {
      if (!userId) return;
      try {
        const profileRef = doc(db, 'userProfiles', userId);
        const profile = await getDoc(profileRef);
        if (profile.exists()) {
          if (profile.data().notificationPrefs) {
            setPreferences(profile.data().notificationPrefs);
          }
          if (profile.data().fcmToken) {
            setFcmToken(profile.data().fcmToken);
          }
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
    };
    loadPreferences();
  }, [userId]);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setFcmToken(token);
        setPermission('granted');

        // Save token to user profile
        if (userId) {
          const profileRef = doc(db, 'userProfiles', userId);
          await updateDoc(profileRef, { fcmToken: token });
        }
      } else {
        // Permission was denied or failed
        setPermission(Notification.permission);
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);

    // Save to Firestore
    if (userId) {
      try {
        const profileRef = doc(db, 'userProfiles', userId);
        await updateDoc(profileRef, { notificationPrefs: newPrefs });
      } catch (error) {
        console.error('Failed to save notification preferences:', error);
      }
    }
  };

  // Check if notifications are supported
  const notificationsSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

  if (!notificationsSupported) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-white/50">
          <BellOff className="w-5 h-5" />
          <span>Notifications are not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-emerald-400" />
        Notifications
      </h3>

      {permission !== 'granted' ? (
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Enable notifications to get reminders to rate your shows and stay updated on new features.
          </p>

          {permission === 'denied' ? (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium text-sm">Notifications are blocked</p>
                <p className="text-white/50 text-xs mt-1">
                  To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site.
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleEnableNotifications}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
            >
              <Bell className="w-4 h-4" />
              {loading ? 'Enabling...' : 'Enable Notifications'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <Check className="w-4 h-4" />
            Notifications enabled
          </div>

          <div className="space-y-3">
            {[
              { key: 'showReminders', label: 'Show rating reminders', desc: 'Remind me to rate shows I attended' },
              { key: 'newFeatures', label: 'New features', desc: 'Get notified about new app features' },
              { key: 'communityUpdates', label: 'Community updates', desc: 'Updates from the concert community' }
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-white/10 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <span className="text-white text-sm font-medium group-hover:text-emerald-400 transition-colors">
                    {label}
                  </span>
                  <p className="text-white/50 text-xs">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
