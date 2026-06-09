/**
 * Loading scene shown during navigation between (app) routes. The World Cup
 * trophy itself is the vessel: cream-empty trophy outline with an amber fill
 * that rises bottom-up on a 1.2s cycle (fill → hold → drain → restart),
 * clipped to the trophy silhouette. Tab bar stays visible since loading.tsx
 * is a Suspense child of the (app) layout.
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
        gap: 16,
        padding: 24,
      }}
    >
      <Trophy />
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

// Single compound path from world-cup-soccer-svgrepo-com.svg (CC0). Reused
// in three layers: empty (cream fill), animated amber (clipped), and outline.
const TROPHY_PATH = "M384,449.963v-12.629c0-17.643-14.357-32-32-32h-15.104c-19.989-34.176-27.52-93.973-27.563-127.659c3.349-6.059,6.549-11.712,9.237-16.341c17.557-30.379,44.096-99.072,44.096-133.333v-4.821c0-5.845-0.043-10.368-0.192-14.336c0.085-0.619,0.192-1.707,0.192-2.176C362.667,47.851,314.816,0,256,0S149.333,47.851,149.333,106.667c0,13.141,2.645,25.835,7.211,37.717c0.043,0.213-0.021,0.427,0.021,0.64l46.763,185.728c-9.493,31.317-23.019,62.037-28.779,74.581H160c-17.643,0-32,14.357-32,32v12.629c-12.395,4.416-21.333,16.149-21.333,30.037v21.333c0,5.888,4.779,10.667,10.667,10.667h277.333c5.888,0,10.667-4.779,10.667-10.667V480C405.333,466.112,396.395,454.379,384,449.963z M256,21.333c40.107,0,73.579,27.883,82.709,64.747c-9.323,1.856-12.672,12.373-16.704,27.072c-1.792,6.528-3.691,12.843-5.76,18.859c-6.677-14.912-21.568-25.344-38.912-25.344c-18.667,0-34.389,12.117-40.171,28.843c-2.453-5.333-4.843-10.965-7.232-17.003c-7.04-17.792-13.12-33.173-27.285-33.173c-4.117,0-7.851,1.771-10.496,4.992c-7.296,8.875-5.269,28.096,3.819,76.352c-15.936-15.744-25.301-37.141-25.301-60.011C170.667,59.605,208.939,21.333,256,21.333z M298.667,149.333c0,11.755-9.557,21.333-21.333,21.333S256,161.088,256,149.333c0-11.755,9.557-21.333,21.333-21.333S298.667,137.579,298.667,149.333z M189.76,189.483c3.84,3.051,7.893,5.845,12.203,8.384c5.717,29.824,11.371,61.099,11.371,79.467c0,1.536-0.149,3.221-0.235,4.821L189.76,189.483z M234.667,277.333c0-22.933-7.168-59.904-14.101-95.659c-3.243-16.789-7.189-37.035-9.536-53.035c9.472,23.893,23.829,56.832,56.939,62.251c3.029,0.683,6.144,1.109,9.365,1.109c3.392,0,6.656-0.491,9.835-1.259c34.816-6.123,47.445-43.371,54.165-67.435V128c0,27.157-23.061,91.2-42.219,124.373C285.12,276.565,256,326.912,256,373.333c0,5.888,4.779,10.667,10.667,10.667s10.667-4.779,10.667-10.667c0-18.496,5.717-38.229,13.184-56.619c3.136,28.309,9.664,62.016,22.08,88.619H197.952C210.347,377.365,234.667,317.333,234.667,277.333z M149.333,437.333c0-5.888,4.8-10.667,10.667-10.667h192c5.867,0,10.667,4.779,10.667,10.667V448H149.333V437.333z M384,490.667H128V480c0-5.888,4.8-10.667,10.667-10.667h234.667C379.2,469.333,384,474.112,384,480V490.667z";

function Trophy() {
  return (
    <svg
      viewBox="0 0 512 512"
      width="220"
      height="220"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading"
    >
      <defs>
        <linearGradient id="ld-amber-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E59C20" />
          <stop offset="100%" stopColor="#B86C0C" />
        </linearGradient>
        <clipPath id="ld-trophy-clip">
          <path d={TROPHY_PATH} />
        </clipPath>
      </defs>

      {/* Empty state: cream fill so the trophy reads as a vessel before
          the amber rises. */}
      <path d={TROPHY_PATH} fill="#FBF4E0" />

      {/* Beer fill clipped to the trophy silhouette. The rect is 600 tall so
          it can translate fully below the trophy (empty state) without an
          exposed top edge. */}
      <g clipPath="url(#ld-trophy-clip)">
        <g className="ld-fill">
          <rect x="0" y="0" width="512" height="600" fill="url(#ld-amber-v)" />
          {/* foam line skimming the top of the amber */}
          <ellipse cx="256" cy="0" rx="180" ry="9" fill="#FFFEF2" />
          <ellipse cx="220" cy="-2" rx="22" ry="5" fill="#FFFFFF" opacity="0.85" />
          <ellipse cx="290" cy="0" rx="16" ry="4" fill="#FFFFFF" opacity="0.85" />
        </g>
      </g>

      {/* Trophy outline on top so detail lines stay crisp through the fill. */}
      <path d={TROPHY_PATH} fill="none" stroke="#1C140C" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
