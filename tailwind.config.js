/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Gowun Dodum"', 'sans-serif'],
        body: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#FBF7F0',
        ink: '#3E3A36',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(62, 58, 54, 0.06)',
        card: '0 4px 16px rgba(62, 58, 54, 0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
