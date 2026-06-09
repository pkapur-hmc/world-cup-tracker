/**
 * Loading scene shown during navigation between (app) routes. The cup matches
 * mark.svg exactly (same handle/base/glass paths and gradients); beer fills
 * from the bottom on a 1.2s cycle, briefly tops out, then quick-drains and
 * starts over. The World Cup trophy stands beside it. Tab bar stays visible
 * since loading.tsx is a Suspense child of the (app) layout.
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
        gap: 14,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <TrophySvg />
        <MugSvg />
      </div>
      <div
        className="t-small muted"
        style={{
          fontFamily: "var(--ff-display)",
          fontSize: 13,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Pouring...
      </div>
    </div>
  );
}

function TrophySvg() {
  // Path lifted from world-cup-soccer-svgrepo-com.svg (CC0). Recolored with
  // the loader trophy gradient so it sits next to the mug instead of clashing.
  return (
    <svg
      className="ld-trophy"
      viewBox="0 0 512 512"
      width="92"
      height="92"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ld-trophy-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5C242" />
          <stop offset="55%" stopColor="#D88817" />
          <stop offset="100%" stopColor="#7A4308" />
        </linearGradient>
      </defs>
      <g fill="url(#ld-trophy-grad)" stroke="#1C140C" strokeWidth="6" strokeLinejoin="round">
        <path
          d="M384,449.963v-12.629c0-17.643-14.357-32-32-32h-15.104c-19.989-34.176-27.52-93.973-27.563-127.659
          c3.349-6.059,6.549-11.712,9.237-16.341c17.557-30.379,44.096-99.072,44.096-133.333v-4.821c0-5.845-0.043-10.368-0.192-14.336
          c0.085-0.619,0.192-1.707,0.192-2.176C362.667,47.851,314.816,0,256,0S149.333,47.851,149.333,106.667
          c0,13.141,2.645,25.835,7.211,37.717c0.043,0.213-0.021,0.427,0.021,0.64l46.763,185.728
          c-9.493,31.317-23.019,62.037-28.779,74.581H160c-17.643,0-32,14.357-32,32v12.629c-12.395,4.416-21.333,16.149-21.333,30.037
          v21.333c0,5.888,4.779,10.667,10.667,10.667h277.333c5.888,0,10.667-4.779,10.667-10.667V480
          C405.333,466.112,396.395,454.379,384,449.963z M256,21.333c40.107,0,73.579,27.883,82.709,64.747
          c-9.323,1.856-12.672,12.373-16.704,27.072c-1.792,6.528-3.691,12.843-5.76,18.859c-6.677-14.912-21.568-25.344-38.912-25.344
          c-18.667,0-34.389,12.117-40.171,28.843c-2.453-5.333-4.843-10.965-7.232-17.003c-7.04-17.792-13.12-33.173-27.285-33.173
          c-4.117,0-7.851,1.771-10.496,4.992c-7.296,8.875-5.269,28.096,3.819,76.352c-15.936-15.744-25.301-37.141-25.301-60.011
          C170.667,59.605,208.939,21.333,256,21.333z M298.667,149.333c0,11.755-9.557,21.333-21.333,21.333S256,161.088,256,149.333
          c0-11.755,9.557-21.333,21.333-21.333S298.667,137.579,298.667,149.333z M189.76,189.483c3.84,3.051,7.893,5.845,12.203,8.384
          c5.717,29.824,11.371,61.099,11.371,79.467c0,1.536-0.149,3.221-0.235,4.821L189.76,189.483z M234.667,277.333
          c0-22.933-7.168-59.904-14.101-95.659c-3.243-16.789-7.189-37.035-9.536-53.035c9.472,23.893,23.829,56.832,56.939,62.251
          c3.029,0.683,6.144,1.109,9.365,1.109c3.392,0,6.656-0.491,9.835-1.259c34.816-6.123,47.445-43.371,54.165-67.435V128
          c0,27.157-23.061,91.2-42.219,124.373C285.12,276.565,256,326.912,256,373.333c0,5.888,4.779,10.667,10.667,10.667
          s10.667-4.779,10.667-10.667c0-18.496,5.717-38.229,13.184-56.619c3.136,28.309,9.664,62.016,22.08,88.619H197.952
          C210.347,377.365,234.667,317.333,234.667,277.333z M149.333,437.333c0-5.888,4.8-10.667,10.667-10.667h192
          c5.867,0,10.667,4.779,10.667,10.667V448H149.333V437.333z M384,490.667H128V480c0-5.888,4.8-10.667,10.667-10.667h234.667
          C379.2,469.333,384,474.112,384,480V490.667z"
        />
      </g>
    </svg>
  );
}

function MugSvg() {
  // Geometry copied verbatim from public/mark.svg so the loader cup is
  // identical to the brand mark. The amber + foam fill is the only animated
  // layer; everything else is the static cup, handle, and base.
  return (
    <svg
      viewBox="0 0 460 540"
      width="150"
      height="176"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ld-amber-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E59C20" />
          <stop offset="100%" stopColor="#B86C0C" />
        </linearGradient>
        <linearGradient id="ld-handle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2A2420" />
          <stop offset="50%" stopColor="#15110E" />
          <stop offset="100%" stopColor="#08060A" />
        </linearGradient>
        <linearGradient id="ld-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A2420" />
          <stop offset="100%" stopColor="#08060A" />
        </linearGradient>
        <filter id="ld-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#7A4308" floodOpacity="0.18" />
        </filter>
        <clipPath id="ld-glass">
          <path d="M 130 110 L 310 110 L 296 332 L 144 332 Z" />
        </clipPath>
      </defs>

      <g filter="url(#ld-shadow)">
        {/* Handle */}
        <path
          d="M 308 158 C 356 154, 364 230, 356 254 C 348 280, 326 288, 290 282 L 294 262 C 318 266, 334 256, 336 238 C 338 216, 330 188, 308 188 Z"
          fill="url(#ld-handle)"
          stroke="#1C140C"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Base */}
        <path
          d="M 132 332 L 308 332 L 322 372 L 118 372 Z"
          fill="url(#ld-base)"
          stroke="#1C140C"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <line x1="122" y1="362" x2="318" y2="362" stroke="#F5EDD4" strokeWidth="2" strokeOpacity="0.35" />

        {/* Empty glass: cream interior with the same outline as the brand mark */}
        <path
          d="M 130 110 L 310 110 L 296 332 L 144 332 Z"
          fill="#FBF4E0"
          stroke="#1C140C"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Pour stream above the rim */}
        <g className="ld-pour">
          <rect x="218" y="30" width="6" height="80" fill="url(#ld-amber-v)" />
          <circle cx="221" cy="108" r="5" fill="#E59C20" />
        </g>

        {/* Beer fill (clipped to glass). Translated up by the animation. */}
        <g clipPath="url(#ld-glass)">
          <g className="ld-fill">
            <rect x="120" y="110" width="200" height="240" fill="url(#ld-amber-v)" />
            {/* foam line sits at the top of the amber */}
            <ellipse cx="220" cy="112" rx="92" ry="8" fill="#FFFEF2" />
            <ellipse cx="200" cy="110" rx="14" ry="4" fill="#FFFFFF" opacity="0.85" />
            <ellipse cx="240" cy="111" rx="10" ry="3" fill="#FFFFFF" opacity="0.85" />
          </g>
        </g>
      </g>
    </svg>
  );
}
