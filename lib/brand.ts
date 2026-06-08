/**
 * Canonical palette as TS constants.
 * The app reads CSS variables from app/styles.css; this file exists
 * only for places that can't read CSS vars (e.g. next/og ImageResponse).
 */
export const COLORS = {
  pour: "#E59C20",
  foam: "#F2EAD3",
  stout: "#1C140C",
  honey: "#D88817",
  burn: "#B86C0C",
  bubble: "#FBF4E0",
  paper: "#EDDFB8",
  foamLit: "#FFFEF2",
  pitch: "#3A6B2E",
  penalty: "#8B2018",
  live: "#C8341B",
} as const;

export const RADII = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
