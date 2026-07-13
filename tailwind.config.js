/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        panel: 'var(--bg-panel)',
        input: 'var(--bg-input)',
        'input-hover': 'var(--bg-input-hover)',
        elevated: 'var(--bg-elevated)',
        hover: 'var(--bg-hover)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-input': 'var(--border-input)',
        'border-canvas': 'var(--border-canvas)',
      },
    },
  },
  plugins: [],
};
