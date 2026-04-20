export default function Pick({ className = '', width = 28, height = 32 }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 160 190"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(75,200,106,0.3))' }}
    >
      <defs>
        <linearGradient id="pick-main" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#6de08a" />
          <stop offset="40%" stopColor="#4bc86a" />
          <stop offset="100%" stopColor="#3ab85a" />
        </linearGradient>
        <linearGradient id="pick-left" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2da44e" />
          <stop offset="100%" stopColor="#3ab85a" />
        </linearGradient>
        <clipPath id="pick-clip">
          <path d="M 95 15 C 130 15, 158 36, 158 65 C 158 94, 138 122, 95 175 C 52 122, 32 94, 32 65 C 32 36, 60 15, 95 15 Z" />
        </clipPath>
      </defs>
      <path
        d="M 95 15 C 130 15, 158 36, 158 65 C 158 94, 138 122, 95 175 C 52 122, 32 94, 32 65 C 32 36, 60 15, 95 15 Z"
        fill="url(#pick-main)"
      />
      <path
        d="M 95 15 C 75 15, 55 28, 42 46 C 35 56, 32 61, 32 65 C 32 94, 52 122, 95 175 C 78 148, 65 125, 58 105 C 50 82, 50 60, 58 42 C 66 26, 80 17, 95 15 Z"
        fill="url(#pick-left)"
        opacity="0.7"
      />
      <g clipPath="url(#pick-clip)">
        <path d="M 52 48 Q 88 58, 130 42" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 45 68 Q 90 82, 140 60" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 40 90 Q 88 108, 148 82" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 38 112 Q 85 134, 148 108" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
