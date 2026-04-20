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
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        hover: 'var(--bg-hover)',
        sidebar: 'var(--bg-sidebar)',
        subtle: 'var(--border-subtle)',
        active: 'var(--border-active)',
        brand: {
          DEFAULT: 'var(--green-primary)',
          light: 'var(--green-light)',
          subtle: 'var(--green-subtle)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          light: 'var(--amber-light)',
          subtle: 'var(--amber-subtle)',
        },
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        'on-dark': 'var(--text-on-dark)',
        'on-dark-muted': 'var(--text-on-dark-muted)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme-md': 'var(--shadow-md)',
        'theme-lg': 'var(--shadow-lg)',
        'theme-xl': 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
