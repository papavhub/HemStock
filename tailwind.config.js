/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 블룸버그 터미널 스타일 팔레트
        terminal: {
          bg:       '#0a0e14',
          panel:    '#0f1520',
          border:   '#1e2d40',
          accent:   '#1a73e8',
          orange:   '#e8860a',
          green:    '#00c853',
          red:      '#f44336',
          yellow:   '#ffd600',
          text:     '#cdd6e0',
          muted:    '#5a7080',
          header:   '#0d1b2a',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
