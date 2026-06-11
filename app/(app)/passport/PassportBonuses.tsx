import { breadthBonus, PASSPORT_BREADTH_EVERY, PASSPORT_COMPLETE_WCC } from "@/lib/scoring";

/**
 * The two passport WCC bonuses, explained where they're earned (Passport tab):
 *   - breadth: +5 for every 5 distinct countries stamped (go wide)
 *   - depth:   +5 for completing a country's full beer list (go deep)
 * Shows live progress toward the next breadth milestone and what's banked so
 * far, so the rule is both learnable and chase-able.
 */
export function PassportBonuses({
  countriesStamped,
  completedCount,
}: {
  countriesStamped: number;
  completedCount: number;
}) {
  const breadthEarned = breadthBonus(countriesStamped);
  const breadthToNext = PASSPORT_BREADTH_EVERY - (countriesStamped % PASSPORT_BREADTH_EVERY);
  const breadthNextMilestone = countriesStamped + breadthToNext;
  const breadthIntoMilestone = countriesStamped % PASSPORT_BREADTH_EVERY;
  const depthEarned = completedCount * PASSPORT_COMPLETE_WCC;

  return (
    <div
      className="card"
      style={{
        background: "var(--bubble)",
        border: "1.5px dashed var(--burn)",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div className="caps-label" style={{ padding: "10px 14px 6px", color: "var(--burn)" }}>
        🛂 Passport bonuses · two ways to bank WCC
      </div>

      {/* Breadth: explore widely */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>🌍</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-sub" style={{ fontSize: 14 }}>
            Stamp <strong>5 different countries</strong> → <strong style={{ color: "var(--burn)" }}>+5 WCC</strong>
            <span className="muted" style={{ fontWeight: 400 }}> (every 5)</span>
          </div>
          <div className="t-small muted" style={{ marginTop: 1 }}>
            {countriesStamped === 0
              ? "Started 0 countries · stamp 5 to bank your first +5"
              : `${countriesStamped} stamped${breadthEarned > 0 ? ` · +${breadthEarned} WCC banked` : ""} · ${breadthToNext} more for +5 (at ${breadthNextMilestone})`}
          </div>
        </div>
      </div>

      {/* breadth progress to next milestone */}
      <div
        style={{
          margin: "0 14px",
          height: 5,
          borderRadius: 999,
          background: "var(--paper)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={PASSPORT_BREADTH_EVERY}
        aria-valuenow={breadthIntoMilestone}
        aria-label="Countries toward next breadth bonus"
      >
        <div
          style={{
            height: "100%",
            width: `${(breadthIntoMilestone / PASSPORT_BREADTH_EVERY) * 100}%`,
            background: "linear-gradient(90deg, var(--pour), var(--burn))",
            transition: "width 300ms ease",
          }}
        />
      </div>

      <div style={{ height: 1, background: "var(--stout-12)", margin: "10px 0 0" }} />

      {/* Depth: complete one fully */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>🏅</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-sub" style={{ fontSize: 14 }}>
            Complete <strong>one country&apos;s full list</strong> → <strong style={{ color: "var(--burn)" }}>+5 WCC</strong>
            <span className="muted" style={{ fontWeight: 400 }}> (each)</span>
          </div>
          <div className="t-small muted" style={{ marginTop: 1 }}>
            {depthEarned > 0
              ? `${completedCount} completed · +${depthEarned} WCC banked`
              : "On top of the +2 per beer - stamp every beer a country lists"}
          </div>
        </div>
      </div>
    </div>
  );
}
