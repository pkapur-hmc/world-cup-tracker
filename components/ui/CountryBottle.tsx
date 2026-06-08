import { colorFor } from "@/data/country-colors";

/**
 * Country-tinted beer bottle. Three colors in play:
 *   - body fill = country `primary`
 *   - label band = `secondary`
 *   - accent stripe = `accent`
 * Plus the flag emoji centered on the label so the country is unmistakable.
 */
export function CountryBottle({
  countryCode,
  flag,
  size = 56,
}: {
  countryCode: string;
  flag: string;
  size?: number;
}) {
  const c = colorFor(countryCode);
  const neck = darken(c.primary, 0.5);
  const labelInk = readableInk(c.secondary);

  return (
    <span
      className="country-bottle"
      style={{ width: size, height: size, position: "relative", display: "inline-block" }}
      aria-hidden
    >
      <svg
        viewBox="0 0 32 64"
        width={size}
        height={size}
        style={{ display: "block" }}
      >
        {/* cap */}
        <rect x="11" y="0" width="10" height="5" rx="1" fill={c.accent} stroke="#1C140C" strokeWidth="0.8" />
        {/* neck */}
        <rect x="13" y="5" width="6" height="9" fill={neck} />
        {/* shoulders + body */}
        <path
          d="M13 14 C 13 16, 8 18, 8 24 L 8 56 C 8 60, 11 62, 16 62 C 21 62, 24 60, 24 56 L 24 24 C 24 18, 19 16, 19 14 Z"
          fill={c.primary}
          stroke="#1C140C"
          strokeWidth="1.2"
        />
        {/* secondary band (label background) */}
        <rect x="8" y="34" width="16" height="18" fill={c.secondary} />
        {/* label paper */}
        <rect
          x="9.5"
          y="36"
          width="13"
          height="14"
          rx="1"
          fill="#FBF4E0"
          stroke="#1C140C"
          strokeWidth="0.6"
        />
        {/* accent thin stripe across body */}
        <rect x="8" y="22" width="16" height="2.4" fill={c.accent} opacity="0.85" />
        {/* shine */}
        <rect x="10" y="16" width="1.4" height="40" rx="0.6" fill="#fff" opacity="0.22" />
        <rect x="22" y="20" width="0.8" height="32" rx="0.4" fill="#000" opacity="0.10" />
        {/* label inner ink hairline for readability */}
        <rect x="9.5" y="36" width="13" height="14" rx="1" fill="none" stroke={labelInk} strokeWidth="0.3" opacity="0.4" />
      </svg>
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "68%",
          transform: "translate(-50%, -50%)",
          fontSize: Math.max(11, Math.floor(size * 0.24)),
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        {flag}
      </span>
    </span>
  );
}

function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C140C";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "#1C140C" : "#FFFEF2";
}
