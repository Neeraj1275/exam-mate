const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const Arrow = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...line}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowBack = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...line}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const Bulb = ({ on }: { on?: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" className={on ? "bulb-svg on" : "bulb-svg"} {...line} strokeWidth={2}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1v.5h5v-.5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </svg>
);

// study desk: books, pencil and a glowing bulb
export const Hero = () => (
  <svg viewBox="0 0 320 240" className="hero-art" role="img" aria-label="Books, a pencil and a light bulb">
    <circle cx="160" cy="125" r="105" fill="#ffe9a8" opacity=".45" />
    <g className="rays" stroke="#e0a800" strokeWidth="3" strokeLinecap="round">
      <path d="M160 14v14M105 36l9 10M215 36l-9 10M88 80h14M232 80h-14" />
    </g>
    <g className="bulb-float">
      <circle cx="160" cy="76" r="32" fill="#ffd75e" stroke="#c99a00" strokeWidth="3" />
      <rect x="145" y="106" width="30" height="14" rx="3" fill="#8a8f94" />
      <rect x="150" y="120" width="20" height="6" rx="3" fill="#6b7075" />
      <path d="M150 70c4-8 16-8 20 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </g>
    <rect x="62" y="196" width="196" height="24" rx="4" fill="#2f6f5e" />
    <rect x="76" y="172" width="170" height="24" rx="4" fill="#c8553d" />
    <rect x="68" y="150" width="158" height="22" rx="4" fill="#3b5ba5" />
    <g fill="#fff" opacity=".85">
      <rect x="236" y="202" width="14" height="12" rx="2" />
      <rect x="226" y="178" width="14" height="12" rx="2" />
      <rect x="216" y="156" width="8" height="10" rx="2" />
    </g>
    <g transform="rotate(-32 255 150)">
      <rect x="205" y="143" width="90" height="13" fill="#f4b942" />
      <rect x="205" y="143" width="14" height="13" fill="#e58b8b" />
      <polygon points="295,143 313,149.5 295,156" fill="#f1d3a0" />
    </g>
    <g fill="#e0a800">
      <path d="M40 90l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
      <path d="M285 60l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </g>
  </svg>
);
