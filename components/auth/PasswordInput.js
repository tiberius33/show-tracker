'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui';

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  disabled = false,
  showStrength = false,
  required = true
}) {
  const [visible, setVisible] = useState(false);

  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(value);
  const strengthColors = ['bg-danger', 'bg-brand', 'bg-brand', 'bg-success', 'bg-brand'];
  const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div>
      <Input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        rightElement={
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="text-muted hover:text-primary transition-colors p-1"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        }
      />

      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1 h-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors ${i < strength ? strengthColors[strength - 1] : 'bg-hover'}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            {strength > 0 ? strengthLabels[strength - 1] : 'Enter password'}
          </p>
        </div>
      )}
    </div>
  );
}
