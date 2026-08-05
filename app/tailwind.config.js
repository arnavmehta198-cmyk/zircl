/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Orbit" light — warm paper surfaces, one azure accent, same token
        // names the screens already use (dusk-* now maps to light values so
        // every screen flips without touching it).
        dusk: { 950: '#F5F8F6', 900: '#FFFFFF', 800: '#EAF0EC' },
        line: { DEFAULT: '#DDE5DF', hi: '#C3CFC6' },
        azure: { DEFAULT: '#1866DE', hover: '#0E4FB6', dim: 'rgba(24,102,222,0.12)' },
        signal: '#17945F',
        warn: '#C9861B',
        danger: '#D64545',
        // Text roles.
        ink: { DEFAULT: '#152219', 2: '#5D6F63', 3: '#94A499' },
        // Stays dark on both themes — text on azure fills, photo scrims.
        deep: '#0D1A11',
        page: '#F5F8F6',
        surface: '#FFFFFF',
        raised: '#EAF0EC',
        accent: { DEFAULT: '#1866DE', hover: '#0E4FB6', soft: 'rgba(24,102,222,0.12)' },
        // Feed match-card only — a dedicated warm palette for the "like"
        // moment, kept separate from the app-wide azure/ink tokens so the
        // rest of the product isn't affected. See FeedScreen/ProfileCard.
        rose: { DEFAULT: '#FF4D6D', hover: '#E63E5C', dim: 'rgba(255,77,109,0.12)' },
        plum: '#2B1625',
        ivory: '#FFF7F2',
        blush: { DEFAULT: '#FFE1E8', text: '#B23A57' },
        gold: '#E8A33D',
      },
      fontFamily: {
        display: ['Shantell Sans', 'system-ui', 'sans-serif'],
        sans: ['Shantell Sans', 'system-ui', 'sans-serif'],
        // Kept separate: timestamps/distances/counts rely on monospace digit
        // alignment, which a handwritten display face can't give them.
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { zircl: '14px', card: '14px', field: '10px' },
      boxShadow: {
        inset: 'inset 0 1px 0 rgba(255,255,255,0.35)',
        // Soft elevation for light surfaces — barely-there, warm-tinted.
        card: '0 1px 2px rgba(21,34,25,0.04), 0 4px 16px rgba(21,34,25,0.05)',
        pop: '0 2px 6px rgba(21,34,25,0.07), 0 16px 40px rgba(21,34,25,0.12)',
      },
      maxWidth: { read: '760px', wide: '1200px' },
      keyframes: {
        pulsering: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        pulsering: 'pulsering 2s ease-out infinite',
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
}
