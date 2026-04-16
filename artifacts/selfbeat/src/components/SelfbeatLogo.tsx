export function SelfbeatLogo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Selfbeat"
    >
      <style>{`
        @keyframes sb-swing {
          0%, 18%  { transform: rotate(62deg); }
          40%      { transform: rotate(37deg); }
          46%      { transform: rotate(41deg); }
          52%      { transform: rotate(38deg); }
          68%, 100%{ transform: rotate(62deg); }
        }
        @keyframes sb-squish {
          0%, 36%, 60%, 100% { transform: scale(1); }
          42%, 50%           { transform: scaleY(0.91) scaleX(1.05); }
        }
        @keyframes sb-ring {
          0%, 34%  { transform: scale(0.4); opacity: 0; }
          41%      { transform: scale(1);   opacity: 0.9; }
          58%      { transform: scale(4.5); opacity: 0; }
          100%     { transform: scale(0.4); opacity: 0; }
        }
        @keyframes sb-spark {
          0%, 36%, 60%, 100% { opacity: 0; }
          41%, 52%           { opacity: 1; }
        }
        @keyframes sb-glow {
          0%, 36%, 60%, 100% { opacity: 0; }
          41%, 50%           { opacity: 0.35; }
        }
        .sb-gavel  { transform-origin: 36px 4px;  animation: sb-swing  2.4s cubic-bezier(0.25,0.46,0.45,0.94) infinite; }
        .sb-brain  { transform-origin: 19px 34px; animation: sb-squish 2.4s ease-in-out infinite; }
        .sb-ring   { transform-origin: 20px 23px; animation: sb-ring   2.4s ease-out infinite; }
        .sb-spark  { animation: sb-spark 2.4s ease-out infinite; }
        .sb-glow   { animation: sb-glow  2.4s ease-out infinite; }
      `}</style>

      {/* ── Brain ────────────────────────────────────────────── */}
      <g className="sb-brain">
        {/* Left hemisphere */}
        <path
          d="M19 23
             C15 21 8 22 6 27
             C4 32 6 39 10 42
             C12 44 15 46 19 45
             Z"
          fill="currentColor"
        />
        {/* Right hemisphere */}
        <path
          d="M19 23
             C23 21 30 22 32 27
             C34 32 32 39 28 42
             C26 44 23 46 19 45
             Z"
          fill="currentColor"
          opacity="0.78"
        />
        {/* Centre sulcus */}
        <line
          x1="19" y1="24" x2="19" y2="44"
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.6"
        />
        {/* Left gyri */}
        <path
          d="M8 30 Q12 28 14 31"
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.3"
          strokeLinecap="round" fill="none"
        />
        <path
          d="M7 37 Q11 35 13 38"
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.3"
          strokeLinecap="round" fill="none"
        />
        {/* Right gyri */}
        <path
          d="M21 29 Q25 27 28 29"
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.3"
          strokeLinecap="round" fill="none"
        />
        <path
          d="M21 37 Q25 35 28 37"
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.3"
          strokeLinecap="round" fill="none"
        />
      </g>

      {/* ── Impact glow ──────────────────────────────────────── */}
      <ellipse
        className="sb-glow"
        cx="20" cy="23" rx="7" ry="4"
        fill="currentColor"
        opacity="0"
      />

      {/* ── Impact ring ──────────────────────────────────────── */}
      <circle
        className="sb-ring"
        cx="20" cy="23" r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0"
      />

      {/* ── Spark lines ──────────────────────────────────────── */}
      <g className="sb-spark" opacity="0">
        <line x1="17" y1="21" x2="14" y2="15"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="20" y1="20" x2="20" y2="14"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="23" y1="21" x2="26" y2="15"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* ── Gavel (pivots at 36,4) ───────────────────────────── */}
      <g className="sb-gavel">
        {/* Handle */}
        <rect x="34.5" y="4" width="3" height="21" rx="1.5" fill="currentColor" />
        {/* Grip wrap */}
        <rect x="34" y="13" width="4" height="5" rx="0.8" fill="currentColor" opacity="0.45" />
        {/* Head */}
        <rect x="28" y="21.5" width="17" height="7.5" rx="2.2" fill="currentColor" />
        {/* Head highlight band */}
        <rect x="35.5" y="21.5" width="2" height="7.5" fill="currentColor" opacity="0.35" />
      </g>
    </svg>
  );
}
