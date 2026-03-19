'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Music } from 'lucide-react';

function SpotifyCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchParams) return;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      sendToOpener({ type: 'spotify-callback', error: errorParam });
      return;
    }

    if (code) {
      sendToOpener({ type: 'spotify-callback', code });
    } else {
      setStatus('error');
      setError('No authorization code received from Spotify.');
    }

    function sendToOpener(message) {
      let sent = false;

      // Method 1: BroadcastChannel (works cross-tab, no window.opener needed)
      try {
        const channel = new BroadcastChannel('spotify-auth');
        channel.postMessage(message);
        sent = true;
      } catch (e) {
        // BroadcastChannel not supported
      }

      // Method 2: window.opener.postMessage (works if opener reference exists)
      if (window.opener) {
        try {
          window.opener.postMessage(message, window.location.origin);
          sent = true;
        } catch (e) {
          // opener not available
        }
      }

      if (sent) {
        if (message.error) {
          setStatus('error');
          setError(message.error === 'access_denied'
            ? 'You cancelled the Spotify login.'
            : `Spotify error: ${message.error}`);
        } else {
          setStatus('success');
          setTimeout(() => window.close(), 800);
        }
      } else {
        // Fallback: store in sessionStorage and redirect
        if (message.code) {
          sessionStorage.setItem('spotify_auth_code', message.code);
        }
        window.location.href = '/shows';
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-void via-surface to-void flex items-center justify-center p-4">
      <div className="bg-highlight border border-subtle rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-accent-amber-glow flex items-center justify-center mx-auto mb-4">
          <Music className="w-6 h-6 text-accent-amber" />
        </div>

        {status === 'processing' && (
          <>
            <h1 className="text-lg font-bold text-primary mb-2">Connecting to Spotify...</h1>
            <div className="h-1 bg-highlight rounded-full overflow-hidden">
              <div className="h-full bg-accent-amber rounded-full animate-pulse w-2/3" />
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-lg font-bold text-primary mb-2">Connected!</h1>
            <p className="text-sm text-secondary">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-lg font-bold text-primary mb-2">Connection Failed</h1>
            <p className="text-sm text-secondary mb-4">{error}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-highlight hover:bg-highlight text-primary rounded-xl text-sm font-medium transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-void via-surface to-void flex items-center justify-center p-4">
        <div className="bg-highlight border border-subtle rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-accent-amber-glow flex items-center justify-center mx-auto mb-4">
            <Music className="w-6 h-6 text-accent-amber" />
          </div>
          <h1 className="text-lg font-bold text-primary mb-2">Connecting to Spotify...</h1>
        </div>
      </div>
    }>
      <SpotifyCallbackContent />
    </Suspense>
  );
}
