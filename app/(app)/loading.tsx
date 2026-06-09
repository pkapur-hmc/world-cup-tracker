/**
 * Brand-flavored loading scene shown during navigation between (app) routes.
 * A mug of WCC fills up under a pour stream while the World Cup trophy stands
 * beside it. The tab bar stays visible (loading.tsx is a Suspense boundary
 * inside the (app) layout), so a tap registers immediately instead of going
 * blank while server data fetches.
 */
export default function AppLoading() {
  return (
    <div
      style={{
        minHeight: "calc(100dvh - 120px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
      }}
    >
      <svg
        viewBox="0 0 260 180"
        width="240"
        height="166"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
      >
        <defs>
          <linearGradient id="ld-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E59C20" />
            <stop offset="100%" stopColor="#B86C0C" />
          </linearGradient>
          <linearGradient id="ld-amber-h" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B86C0C" />
            <stop offset="50%" stopColor="#E59C20" />
            <stop offset="100%" stopColor="#B86C0C" />
          </linearGradient>
          <linearGradient id="ld-trophy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5C242" />
            <stop offset="60%" stopColor="#D88817" />
            <stop offset="100%" stopColor="#7A4308" />
          </linearGradient>
          <linearGradient id="ld-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A2420" />
            <stop offset="100%" stopColor="#08060A" />
          </linearGradient>
          <clipPath id="ld-mug-clip">
            <path d="M 145 56 L 215 56 L 207 142 L 153 142 Z" />
          </clipPath>
        </defs>

        {/* Trophy */}
        <g className="ld-trophy">
          {/* handles */}
          <path
            d="M 32 60 C 12 64 12 92 32 96"
            stroke="url(#ld-trophy)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 92 60 C 112 64 112 92 92 96"
            stroke="url(#ld-trophy)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          {/* cup body */}
          <path
            d="M 30 50 L 94 50 C 94 92, 84 108, 62 114 C 40 108, 30 92, 30 50 Z"
            fill="url(#ld-trophy)"
            stroke="#1C140C"
            strokeWidth="2"
          />
          {/* rim band */}
          <rect x="28" y="48" width="68" height="6" fill="#1C140C" />
          {/* stem */}
          <rect x="56" y="114" width="12" height="14" fill="url(#ld-trophy)" stroke="#1C140C" strokeWidth="2" />
          {/* base */}
          <rect x="42" y="128" width="40" height="6" rx="2" fill="url(#ld-trophy)" stroke="#1C140C" strokeWidth="2" />
          <rect x="34" y="134" width="56" height="10" rx="2" fill="url(#ld-trophy)" stroke="#1C140C" strokeWidth="2" />
        </g>

        {/* Pour stream above the mug */}
        <g className="ld-pour">
          <rect x="178" y="2" width="4" height="54" fill="url(#ld-amber)" />
          <circle cx="180" cy="54" r="3" fill="#E59C20" />
        </g>

        {/* Mug body */}
        <path
          d="M 145 56 L 215 56 L 207 142 L 153 142 Z"
          fill="#FBF4E0"
          stroke="#1C140C"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Mug handle */}
        <path
          d="M 212 70 C 240 70, 240 116, 208 116"
          stroke="#1C140C"
          strokeWidth="3"
          fill="none"
        />

        {/* Beer + foam (animated, clipped) */}
        <g clipPath="url(#ld-mug-clip)">
          <g className="ld-fill">
            {/* foam line sits at the top of the fill */}
            <rect x="140" y="60" width="80" height="90" fill="url(#ld-amber)" />
            <ellipse cx="180" cy="60" rx="38" ry="5" fill="#FFFEF2" />
            <ellipse cx="170" cy="58" rx="6" ry="3" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="188" cy="59" rx="5" ry="2.5" fill="#FFFFFF" opacity="0.9" />
          </g>
        </g>

        {/* Mug base */}
        <path
          d="M 150 142 L 210 142 L 218 156 L 142 156 Z"
          fill="url(#ld-base)"
          stroke="#1C140C"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      <div
        className="t-small muted"
        style={{ fontFamily: "var(--ff-display)", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        Pouring...
      </div>
    </div>
  );
}
