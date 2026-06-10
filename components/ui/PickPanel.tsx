import { FLAG_EMOJI } from "@/data/flag-emojis";
import { colorFor } from "@/data/country-colors";
import { WccIcon } from "@/components/ui/CurrencyIcon";

/**
 * The "Your pick" panel. One canonical look, shared by the home page and the
 * schedule so a picked game reads identically everywhere: country-accented
 * border + foam background, flag + label, and a stake badge (or "no stake").
 */
export function PickPanel({
  teamACode,
  teamBCode,
  pick,
  stake,
  style,
}: {
  teamACode: string | null;
  teamBCode: string | null;
  pick: "A" | "D" | "B";
  stake: number;
  style?: React.CSSProperties;
}) {
  const pickedCode = pick === "A" ? teamACode : pick === "B" ? teamBCode : null;
  const accent = colorFor(pickedCode);
  // Draw: split both teams' tints down the middle with dual edge accents,
  // mirroring the match page's draw hero panel.
  const teamAColor = teamACode ? colorFor(teamACode) : null;
  const teamBColor = teamBCode ? colorFor(teamBCode) : null;
  const drawStyles: React.CSSProperties =
    pick === "D" && teamAColor && teamBColor
      ? {
          background: `linear-gradient(90deg, ${teamAColor.tint} 0%, ${teamAColor.tint} 50%, ${teamBColor.tint} 50%, ${teamBColor.tint} 100%)`,
          borderLeft: `3px solid ${teamAColor.primary}`,
          borderRight: `3px solid ${teamBColor.primary}`,
        }
      : {};
  const pickFlag =
    pick === "A"
      ? flag(teamACode)
      : pick === "B"
        ? flag(teamBCode)
        : "•";
  const pickLabel =
    pick === "A"
      ? teamACode ?? "A"
      : pick === "B"
        ? teamBCode ?? "B"
        : "Draw";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        background: pickedCode ? "var(--foam-lit)" : "var(--paper)",
        border: pickedCode ? `1.5px solid ${accent.primary}` : "1px solid var(--stout-12)",
        borderRadius: "var(--r-md)",
        ...drawStyles,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="caps-label">Your pick</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="flag">{pickFlag}</span>
          <span className="t-sub">{pickLabel}</span>
        </span>
      </div>
      {stake > 0 ? (
        <span
          className="badge stake tnum"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <WccIcon size={12} /> {stake} staked
        </span>
      ) : (
        <span className="t-small muted">no stake</span>
      )}
    </div>
  );
}

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
}
