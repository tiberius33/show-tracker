'use client';
import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth, authProviders } from '@/lib/firebase';
import { nativeGoogleSignIn } from '@/lib/native-auth';
import OAuthButtons from './OAuthButtons';
import AuthDivider from './AuthDivider';
import PasswordInput from './PasswordInput';

export default function LoginForm({ onSuccess, onSwitchToSignup, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Set persistence based on "Remember me" checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (providerName) => {
    setError('');
    setLoading(true);

    try {
      // Set persistence based on "Remember me" checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      // Try native sign-in first (returns null on web → fall through to popup)
      let result = null;
      if (providerName === 'google') {
        result = await nativeGoogleSignIn();
      }

      // If native didn't handle it, use web popup
      if (!result) {
        const provider = authProviders[providerName];
        await signInWithPopup(auth, provider);
      }

      onSuccess?.();
    } catch (err) {
      console.error('OAuth sign-in error:', err.code, err.message);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getErrorMessage(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-primary mb-6 text-center">
        Welcome Back
      </h2>

      <OAuthButtons
        onProviderClick={handleOAuthLogin}
        disabled={loading}
      />

      <AuthDivider />

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
          required
          disabled={loading}
        />

        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password"
          disabled={loading}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-active bg-hover text-brand focus:ring-brand/50 focus:ring-offset-0 cursor-pointer"
              disabled={loading}
            />
            <span className="text-sm text-secondary">Remember me</span>
          </label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="text-danger text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber disabled:opacity-50 text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-secondary mt-6">
        Don't have an account?{' '}
        <button
          onClick={onSwitchToSignup}
          className="text-brand hover:text-brand font-medium"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

function getErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method',
    'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
    'auth/cancelled-popup-request': 'Sign in was cancelled.',
    'auth/unauthorized-domain': 'This domain is not authorized for OAuth operations. Add it in Firebase Console.',
  };
  return messages[code] || `Sign in failed (${code || 'unknown error'}). Please try again.`;
}
