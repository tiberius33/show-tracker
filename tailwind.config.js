/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './context/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        void: 'var(--bg-void)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        highlight: 'var(--bg-highlight)',
        subtle: 'var(--border-subtle)',
        active: 'var(--border-active)',
        'accent-amber': {
          DEFAULT: 'var(--accent-amber)',
          glow: 'var(--accent-amber-glow)',
        },
        'accent-teal': {
          DEFAULT: 'var(--accent-teal)',
          glow: 'var(--accent-teal-glow)',
        },
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
