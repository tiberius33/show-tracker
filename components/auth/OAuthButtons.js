'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { isNativePlatform } from '@/lib/native-auth';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple's mark, as required by the Sign in with Apple Human Interface
// Guidelines: the button must carry it, use the exact wording "Sign in with
// Apple" / "Sign up with Apple", and be black, white, or white-with-outline.
// Do not restyle it.
const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.72-1.35-.14-2.64.79-3.33.79-.69 0-1.75-.77-2.87-.75-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.53zM14.9 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.97-.49 2.58-1.22z" />
  </svg>
);

// Provider configuration.
//
// Apple is listed first on purpose: on iOS the platform sign-in belongs at the
// top, and Apple's guidelines say Sign in with Apple should be shown no lower
// than the other options.
const providers = [
  {
    id: 'apple',
    name: 'Apple',
    Icon: AppleIcon,
    className: 'bg-black text-white hover:bg-neutral-800 border-black',
    // Native only, for now. Sign in with Apple on the web needs a Services ID
    // registered in the Apple Developer portal, a verified domain, a return
    // URL, and the OAuth code flow key — none of which are set up yet.
    // Showing the button on mysetlists.net before that exists would just give
    // people a button that fails. Native needs none of it: iOS authenticates
    // with the bundle identifier and the entitlement.
    //
    // To turn it on for web: finish the Firebase Apple provider setup, then
    // delete this flag.
    nativeOnly: true,
  },
  {
    id: 'google',
    name: 'Google',
    Icon: GoogleIcon,
  },
];

export default function OAuthButtons({ onProviderClick, disabled = false, action = 'signin' }) {
  const actionText = action === 'signup' ? 'Sign up' : 'Sign in';

  // Resolved after mount rather than during render. The app is a static
  // export, so this component is prerendered to HTML at build time on a
  // machine that is not native; deciding during render would disagree with
  // that HTML and trip a hydration mismatch inside the app's webview.
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  const visibleProviders = providers.filter((p) => !p.nativeOnly || isNative);

  return (
    <div className="space-y-3">
      {visibleProviders.map((provider) => (
        <Button
          key={provider.id}
          variant="secondary"
          full
          icon={provider.Icon}
          className={provider.className}
          onClick={() => onProviderClick(provider.id)}
          disabled={disabled}
        >
          {actionText} with {provider.name}
        </Button>
      ))}
    </div>
  );
}
