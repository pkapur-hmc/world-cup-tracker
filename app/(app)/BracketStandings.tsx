import Link from "next/link";
import { getRankInGroup } from "@/lib/stats";

export async function BracketStandings({
  brackets,
  userId,
  activeId,
}: {
  brackets: { groupId: string; groupName: string; memberCount: number }[];
  userId: string;
  activeId: string;
}) {
  if (brackets.length === 0) return null;

  // Compute rank in each bracket in parallel.
  const ranks = await Promise.all(
    brackets.map((b) => getRankInGroup(b.groupId, userId)),
  );

  return (
    <div>
      <div className="section-label" style={{ marginTop: 8 }}>
        <span className="caps-label">🏆 Your brackets</span>
        <Link
          href="/brackets/new"
          className="t-small"
          style={{ color: "var(--burn)", fontWeight: 700, textDecoration: "none" }}
        >
          + New
        </Link>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {brackets.map((b, i) => {
          const r = ranks[i];
          const active = b.groupId === activeId;
          return (
            <div
              key={b.groupId}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                borderTop: i === 0 ? "none" : "1px solid var(--stout-12)",
                background: active ? "var(--paper)" : undefined,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: r.rank <= 3 ? "var(--pour)" : "var(--stout-12)",
                  color: r.rank <= 3 ? "var(--stout)" : "var(--stout-55)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--ff-display)",
                  fontWeight: 800,
                  fontSize: 18,
                  border: r.rank === 1 ? "2px solid var(--stout)" : undefined,
                }}
                aria-label={`Rank ${r.rank}`}
              >
                #{r.rank}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="t-sub" style={{ fontSize: 15 }}>
                  {b.groupName}
                  {active ? (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        background: "var(--stout)",
                        color: "var(--foam-lit)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        verticalAlign: 2,
                      }}
                    >
                      ACTIVE
                    </span>
                  ) : null}
                </div>
                <div className="t-small muted tnum">
                  of {r.total}
                  {r.aheadName ? ` · ${r.aheadName} ahead` : r.rank === 1 ? " · top of the pile" : ""}
                </div>
              </div>
              <Link
                href="/leaderboard"
                className="t-small"
                style={{ color: "var(--burn)", fontWeight: 700, textDecoration: "none" }}
              >
                View →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
