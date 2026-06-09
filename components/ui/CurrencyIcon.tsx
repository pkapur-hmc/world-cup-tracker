import type { CSSProperties } from "react";

type Props = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** WCC = beer mug. The drink-counting currency. */
export function WccIcon({ size = 16, className, style, title = "WCC" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`cur-icon wcc ${className ?? ""}`}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* foam */}
      <path
        d="M5 6 C5 4.5, 6.5 3.5, 8 4 C8.5 3, 10 3, 10.5 4 C11 3, 12.5 3, 13 4 C13.5 3, 15 3, 15.5 4 C17 3.5, 18 4.5, 18 6 L5 6 Z"
        fill="currentColor"
        opacity="0.35"
      />
      {/* mug body */}
      <path
        d="M5 6 L18 6 L17 20 C17 21, 16 22, 15 22 L8 22 C7 22, 6 21, 6 20 L5 6 Z"
        fill="currentColor"
        opacity="0.92"
      />
      {/* handle */}
      <path
        d="M18 9 C21 9, 21 16, 18 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* inner shine */}
      <rect x="7.5" y="10" width="1.6" height="7" rx="0.6" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** Inline number + currency icon pair, e.g. "12 🍺 WCC". */
export function WccTag({ value, size = 14 }: { value: number | string; size?: number }) {
  return (
    <span className="cur-tag">
      <WccIcon size={size} />
      <span className="tnum">{value}</span>
    </span>
  );
}
