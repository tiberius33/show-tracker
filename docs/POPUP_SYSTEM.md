# Popup System

One-time popup announcements for MySetlists. Each popup displays once and won't reappear for 12 months after dismissal.

## Architecture

```
lib/popupManager.js     — Core state management (localStorage)
lib/popups.js           — Popup registry (definitions)
lib/usePopup.js         — React hook for individual popup control
components/PopupOverlay.jsx  — Modal UI component
components/PopupQueue.jsx    — Renders eligible popups sequentially
components/AdminPopups.jsx   — Admin management tab
```

## Adding a New Popup

### 1. Define in the registry

Edit `lib/popups.js` and add to the `POPUPS` array:

```js
{
  id: 'popup-my-feature-v3.18',       // unique ID: popup-{feature}-v{version}
  title: 'New Feature Name',
  content: 'Description of the feature shown to users.',
  variant: 'feature',                  // 'info' | 'warning' | 'feature' | 'announcement'
  releaseVersion: '3.18.0',
  targetAudience: 'all',               // 'all' | 'newUsers' | 'returningUsers' | 'admin'
  // Optional:
  learnMoreUrl: 'https://...',
  learnMoreLabel: 'Learn More',
  enabled: true,                       // set false to disable without removing
}
```

That's it! The popup will automatically appear for matching users on next page load.

### 2. Target audiences

| Value | Who sees it |
|---|---|
| `all` | Every authenticated user + guests |
| `newUsers` | Users with 0 shows |
| `returningUsers` | Users with 1+ shows |
| `admin` | Admin users only |

### 3. Variants

| Variant | Use case | Icon | Color |
|---|---|---|---|
| `feature` | New feature announcement | Sparkles | Green/brand |
| `announcement` | General news | Megaphone | Green |
| `info` | Informational/onboarding | Info | Blue |
| `warning` | Maintenance/alerts | Alert Triangle | Amber |

## Using the Hook (Advanced)

For standalone popup control outside the queue:

```jsx
import { usePopup } from '@/lib/usePopup';
import PopupOverlay from '@/components/PopupOverlay';

function MyComponent() {
  const { isVisible, dismiss } = usePopup('popup-custom-v1');

  if (!isVisible) return null;

  return (
    <PopupOverlay
      popupId="popup-custom-v1"
      title="Custom Popup"
      variant="info"
      onDismiss={dismiss}
    >
      <p>Custom content here</p>
    </PopupOverlay>
  );
}
```

## How Dismissal Works

1. User clicks **"Got It"** button
2. `popupManager.dismissPopup(id)` stores a record in localStorage:
   ```json
   {
     "popup-feature-v3.17": {
       "popupId": "popup-feature-v3.17",
       "dismissedAt": "2026-03-26T12:00:00.000Z",
       "expiresAt": "2027-03-26T12:00:00.000Z"
     }
   }
   ```
3. On next page load, `shouldShowPopup(id)` checks the record and returns `false`
4. After 12 months (365 days), the record expires and the popup becomes eligible again

### localStorage Schema

- **Key**: `mysetlists_popup_dismissals`
- **Value**: JSON object mapping popup IDs to dismissal records
- **Fallback**: If localStorage is full, falls back to sessionStorage

## Testing Locally

### Quick reset via browser console

```js
// Show all popup states
JSON.parse(localStorage.getItem('mysetlists_popup_dismissals'))

// Reset a specific popup
const data = JSON.parse(localStorage.getItem('mysetlists_popup_dismissals'));
delete data['popup-my-feature-v3.18'];
localStorage.setItem('mysetlists_popup_dismissals', JSON.stringify(data));

// Reset ALL popups
localStorage.removeItem('mysetlists_popup_dismissals');
// Then refresh the page
```

### Enable debug logging

Set `NEXT_PUBLIC_POPUP_DEBUG=true` in `.env.local`:

```
NEXT_PUBLIC_POPUP_DEBUG=true
```

This enables console logs like:
```
[PopupManager] Dismissed popup-feature-v3.17 — expires 2027-03-26T12:00:00.000Z
[PopupManager] Cleaned up 2 expired dismissal(s)
```

## Admin Utilities

Navigate to **Admin > Popups** tab to:

- View all popup states (active, dismissed, disabled)
- Preview any popup without triggering dismissal
- Reset individual or all popup dismissals
- Run cleanup of expired dismissals
- Copy raw localStorage data for debugging
- See days remaining until re-eligible

## Running Tests

### Unit tests

```bash
node lib/__tests__/popupManager.test.js
```

### Integration tests (Playwright)

```bash
npx playwright test e2e/popup.spec.js
```

## Edge Cases Handled

- **Clock skew**: If `dismissedAt` is in the future (>1 min), treated as invalid
- **localStorage full**: Falls back to sessionStorage for the session
- **Corrupted data**: Invalid JSON or unexpected data types are reset gracefully
- **SSR safety**: All browser APIs are guarded with `typeof window !== 'undefined'`
- **Multiple popups**: Shown one at a time; counter shows remaining announcements
