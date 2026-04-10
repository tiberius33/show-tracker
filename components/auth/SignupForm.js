'use client';
import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { auth, authProviders } from '@/lib/firebase';
import { nativeGoogleSignIn } from '@/lib/native-auth';
import OAuthButtons from './OAuthButtons';
import AuthDivider from './AuthDivider';
import PasswordInput from './PasswordInput';

export default function SignupForm({ onSuccess, onSwitchToLogin }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain a number';
    return null;
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: displayName.trim()
      });

      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (providerName) => {
    setError('');
    setLoading(true);

    try {
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
        Create Account
      </h2>

      <OAuthButtons
        onProviderClick={handleOAuthSignup}
        disabled={loading}
        action="signup"
      />

      <AuthDivider />

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-4 py-3 bg-hover border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-primary placeholder-muted"
          required
          disabled={loading}
        />

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
          showStrength
        />

        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm password"
          disabled={loading}
        />

        {error && (
          <p className="text-danger text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-brand to-amber hover:from-brand hover:to-amber disabled:opacity-50 text-primary rounded-xl font-medium transition-all shadow-lg shadow-brand/20"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-secondary mt-6">
        Already have an account?{' '}
        <button
          onClick={onSwitchToLogin}
          className="text-brand hover:text-brand font-medium"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

function getErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled',
    'auth/weak-password': 'Password is too weak',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method',
  };
  return messages[code] || 'Sign up failed. Please try again.';
}
