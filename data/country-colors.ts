/**
 * Per-country color palette - three brand colors plus a soft `tint` wash
 * and a foreground `ink` that reads on the tint.
 *
 *   primary   - dominant flag/jersey color. Used on borders, CTAs, bottle body.
 *   secondary - the second flag color. Used on accents (bottle label band,
 *               minus button, secondary fills).
 *   accent    - third flag color or complementary highlight. Used sparingly
 *               (count chips, hover states, the sheet's deeper band).
 *   tint      - paper-tone wash of primary. Safe behind text. Background panel.
 *   tint2     - paper-tone wash of secondary. Stacked-layer accent.
 *   ink       - foreground color that reads on `tint`/`tint2`.
 *
 * Three colors per country - leans into "fun, country-flavored" without
 * forcing a heavy theme. Layers (primary stripe + tint background + accent
 * dots/buttons) keep things distinct between Brazil, Germany, Mexico, etc.
 */

export type CountryColor = {
  primary: string;
  secondary: string;
  accent: string;
  tint: string;
  tint2: string;
  ink: string;
};

export const FALLBACK_COLOR: CountryColor = {
  primary: "#1C140C",
  secondary: "#B86C0C",
  accent: "#E59C20",
  tint: "rgba(28, 20, 12, 0.08)",
  tint2: "rgba(184, 108, 12, 0.12)",
  ink: "#1C140C",
};

// Helper that produces a tint at the given alpha from a #rrggbb.
function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(28,20,12,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mk(primary: string, secondary: string, accent: string, tintAlpha = 0.22, tint2Alpha = 0.16): CountryColor {
  return {
    primary,
    secondary,
    accent,
    tint: tint(primary, tintAlpha),
    tint2: tint(secondary, tint2Alpha),
    ink: "#1C140C",
  };
}

export const COUNTRY_COLORS: Record<string, CountryColor> = {
  ARG: mk("#75AADB", "#FFFFFF", "#F4B400", 0.28, 0.0),
  AUS: mk("#00843D", "#FFCC00", "#D52B1E", 0.20, 0.22),
  AUT: mk("#ED2939", "#FFFFFF", "#1C140C", 0.18, 0.0),
  BEL: mk("#FAE042", "#1C140C", "#EF3340", 0.32, 0.10),
  BIH: mk("#002395", "#FECB00", "#FFFFFF", 0.18, 0.28),
  BRA: mk("#FEDF00", "#009C3B", "#002776", 0.32, 0.20),
  CAN: mk("#D52B1E", "#FFFFFF", "#1C140C", 0.20, 0.0),
  CIV: mk("#F77F00", "#FFFFFF", "#009E60", 0.26, 0.22),
  COD: mk("#007FFF", "#FFCD00", "#CE1126", 0.20, 0.24),
  COL: mk("#FCD116", "#003893", "#CE1126", 0.32, 0.20),
  CPV: mk("#003893", "#FFFFFF", "#CF2027", 0.20, 0.0),
  CRO: mk("#E1001C", "#FFFFFF", "#002F87", 0.20, 0.20),
  CUW: mk("#002395", "#F9E300", "#FFFFFF", 0.20, 0.24),
  CZE: mk("#11457E", "#D7141A", "#FFFFFF", 0.20, 0.18),
  ECU: mk("#FFD100", "#0072CE", "#EF3340", 0.30, 0.22),
  EGY: mk("#CE1126", "#1C140C", "#C09300", 0.20, 0.10),
  ENG: mk("#CE1124", "#FFFFFF", "#0050A0", 0.20, 0.20),
  ESP: mk("#AA151B", "#F1BF00", "#1C140C", 0.20, 0.30),
  FRA: mk("#0055A4", "#FFFFFF", "#EF4135", 0.20, 0.20),
  GER: mk("#1C140C", "#DD0000", "#FFCE00", 0.16, 0.20),
  GHA: mk("#006B3F", "#FFD700", "#CE1126", 0.22, 0.28),
  HAI: mk("#00209F", "#D21034", "#FFFFFF", 0.20, 0.18),
  IRN: mk("#239F40", "#FFFFFF", "#DA0000", 0.22, 0.20),
  IRQ: mk("#CE1126", "#1C140C", "#FFFFFF", 0.20, 0.10),
  JOR: mk("#007A3D", "#CE1126", "#1C140C", 0.22, 0.18),
  JPN: mk("#BC002D", "#FFFFFF", "#1C140C", 0.20, 0.0),
  KOR: mk("#003478", "#CD2E3A", "#FFFFFF", 0.20, 0.18),
  KSA: mk("#006C35", "#FFFFFF", "#1C140C", 0.22, 0.0),
  MAR: mk("#C1272D", "#006233", "#FFFFFF", 0.20, 0.22),
  MEX: mk("#006847", "#CE1126", "#FFFFFF", 0.26, 0.18),
  NED: mk("#FF7900", "#21468B", "#AE1C28", 0.26, 0.20),
  NOR: mk("#BA0C2F", "#00205B", "#FFFFFF", 0.20, 0.18),
  NZL: mk("#1C140C", "#012169", "#CC142B", 0.14, 0.22),
  PAN: mk("#D52B1E", "#005AA7", "#FFFFFF", 0.20, 0.20),
  PAR: mk("#D52B1E", "#FFFFFF", "#0038A8", 0.20, 0.0),
  POR: mk("#006600", "#D81E05", "#FFD700", 0.22, 0.18),
  QAT: mk("#8A1538", "#FFFFFF", "#1C140C", 0.22, 0.0),
  RSA: mk("#007749", "#FFB81C", "#DE3831", 0.22, 0.26),
  SCO: mk("#0065BD", "#FFFFFF", "#1C140C", 0.22, 0.0),
  SEN: mk("#00853F", "#FDEF42", "#E31B23", 0.22, 0.28),
  SUI: mk("#D52B1E", "#FFFFFF", "#1C140C", 0.18, 0.0),
  SWE: mk("#006AA7", "#FECC00", "#FFFFFF", 0.20, 0.30),
  TUN: mk("#E70013", "#FFFFFF", "#1C140C", 0.20, 0.0),
  TUR: mk("#E30A17", "#FFFFFF", "#1C140C", 0.20, 0.0),
  URY: mk("#0038A8", "#FCD116", "#FFFFFF", 0.22, 0.28),
  USA: mk("#3C3B6E", "#B22234", "#FFFFFF", 0.22, 0.20),
  UZB: mk("#1EB53A", "#0099B5", "#CE1126", 0.22, 0.20),
  ALG: mk("#006233", "#FFFFFF", "#D21034", 0.22, 0.20),
};

export function colorFor(code: string | null | undefined): CountryColor {
  if (!code) return FALLBACK_COLOR;
  return COUNTRY_COLORS[code] ?? FALLBACK_COLOR;
}
