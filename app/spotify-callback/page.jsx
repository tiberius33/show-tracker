'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Music } from 'lucide-react';

export default function SpotifyCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchParams) return;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      // User denied access or something went wrong
      if (window.opener) {
        window.opener.postMessage({ type: 'spotify-callback', error: errorParam }, window.location.origin);
        window.close();
      } else {
        setStatus('error');
        setError(errorParam === 'access_denied' ? 'You cancelled the Spotify login.' : `Spotify error: ${errorParam}`);
      }
      return;
    }

    if (code) {
      // Send the code back to the opener window
      if (window.opener) {
        window.opener.postMessage({ type: 'spotify-callback', code }, window.location.origin);
        setStatus('success');
        setTimeout(() => window.close(), 500);
      } else {
        // Fallback: redirect flow (no popup opener)
        // Store code and redirect to shows page where PlaylistCreatorModal will pick it up
        sessionStorage.setItem('spotify_auth_code', code);
        window.location.href = '/shows';
      }
    } else {
      setStatus('error');
      setError('No authorization code received from Spotify.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Music className="w-6 h-6 text-emerald-400" />
        </div>

        {status === 'processing' && (
          <>
            <h1 className="text-lg font-bold text-white mb-2">Connecting to Spotify...</h1>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-pulse w-2/3" />
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-lg font-bold text-white mb-2">Connected!</h1>
            <p className="text-sm text-white/50">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-lg font-bold text-white mb-2">Connection Failed</h1>
            <p className="text-sm text-white/50 mb-4">{error}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
