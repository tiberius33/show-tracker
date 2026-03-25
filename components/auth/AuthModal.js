'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';

export default function AuthModal({ mode, onClose, onSwitchMode, onSuccess }) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={onSuccess}
            onSwitchToSignup={() => onSwitchMode('signup')}
            onForgotPassword={() => onSwitchMode('forgot-password')}
          />
        );
      case 'signup':
        return (
          <SignupForm
            onSuccess={onSuccess}
            onSwitchToLogin={() => onSwitchMode('login')}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onBackToLogin={() => onSwitchMode('login')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-sidebar/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface backdrop-blur-xl border border-subtle rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 text-secondary hover:text-primary active:bg-hover rounded-xl transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {renderForm()}
      </div>
    </div>
  );
}
