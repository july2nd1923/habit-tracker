@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  height: 100%;
}

body {
  font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif;
  color: #3E3A36;
  background-color: #FBF7F0;
  background-image: radial-gradient(#00000008 1px, transparent 1px);
  background-size: 18px 18px;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-thumb {
  background: #00000018;
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
