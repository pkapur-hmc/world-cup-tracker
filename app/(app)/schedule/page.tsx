import Link from "next/link";
import { getMatchesList, matchPhase, venueCity, type Match } from "@/lib/fixtures";
import { getCurrentMembership } from "@/lib/membership";
import { getUserPicksByMatch, getUserDrinkStatsByMatch } from "@/lib/picks";
import { getMemberStats } from "@/lib/stats";
import { WccIcon } from "@/components/ui/CurrencyIcon";
import { ScheduleList, type ScheduleItem } from "./ScheduleList";

const STAGES: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "group", label: "Group" },
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
];

function scheduleHref(view: "upcoming" | "past", stage: string): string {
  const params = new URLSearchParams();
  if (view === "past") params.set("view", "past");
  if (stage) params.set("stage", stage);
  const qs = params.toString();
  return qs ? `/schedule?${qs}` : "/schedule";
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; view?: string }>;
}) {
  const params = await searchParams;
  const activeStage = STAGES.find((s) => s.key === params.stage)?.key ?? "";
  const view: "upcoming" | "past" = params.view === "past" ? "past" : "upcoming";

  const member = await getCurrentMembership();
  const [matches, picksByMatch, drinksByMatch, stats] = await Promise.all([
    getMatchesList(activeStage ? (activeStage as Match["stage"]) : undefined),
    member ? getUserPicksByMatch(member.userId) : Promise.resolve(new Map()),
    member && view === "past"
      ? getUserDrinkStatsByMatch(member.userId)
      : Promise.resolve(new Map<number, { drinks: number; wcc: number }>()),
    member && view === "past" ? getMemberStats("", member.userId) : Promise.resolve(null),
  ]);

  let items: ScheduleItem[];
  if (view === "past") {
    // History: most recent final first, each card carrying YOUR result for
    // that match (pours, pick outcome, net WCC).
    items = matches
      .filter((match) => matchPhase(match) === "post")
      .sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at))
      .map((match) => {
        const pick = picksByMatch.get(match.id) ?? null;
        const drinks = drinksByMatch.get(match.id) ?? { drinks: 0, wcc: 0 };
        return {
          match,
          myPick: null,
          city: venueCity(match.venue),
          history: {
            pours: drinks.drinks,
            pourWcc: drinks.wcc,
            pick,
            net:
              drinks.wcc +
              (pick ? pick.payout_wcp + pick.payout_wcc - pick.stake : 0),
          },
        };
      });
  } else {
    // The schedule is forward-looking: once a match ends it moves to Past.
    items = matches
      .filter((match) => matchPhase(match) !== "post")
      .map((match) => ({
        match,
        myPick: picksByMatch.get(match.id) ?? null,
        city: venueCity(match.venue),
      }));
  }

  // Pick record across settled, non-refunded picks: the bragging number.
  let picksCorrect = 0;
  let picksSettled = 0;
  if (view === "past") {
    for (const p of picksByMatch.values()) {
      if (!p.settled_at || p.payout_wcc > 0) continue; // pending or refunded
      picksSettled += 1;
      if (p.payout_wcp > 0) picksCorrect += 1;
    }
  }

  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="t-h1">Schedule</div>
          <div className="t-small muted">
            {view === "past"
              ? `${items.length} played`
              : `${items.length} matches · Jun 11 - Jul 19`}
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 0 }}>
        <div className="seg-tabs" style={{ marginBottom: 12 }}>
          <Link
            href={scheduleHref("upcoming", activeStage)}
            className={`seg-tab ${view === "upcoming" ? "is-active" : ""}`}
          >
            Upcoming
          </Link>
          <Link
            href={scheduleHref("past", activeStage)}
            className={`seg-tab ${view === "past" ? "is-active" : ""}`}
          >
            Past
          </Link>
        </div>

        {view === "past" && stats ? (
          <div className="card" style={{ marginBottom: 4 }}>
            <div className="caps-label" style={{ marginBottom: 10 }}>
              Your tournament so far
            </div>
            <div className="stat-grid">
              <div className="stat-cell">
                <div className="stat-num" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <WccIcon size={20} />
                  {stats.wcc}
                </div>
                <div className="stat-label">WCC</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num">
                  {picksCorrect}
                  <span style={{ fontSize: 18, color: "var(--stout-55)" }}>/{picksSettled}</span>
                </div>
                <div className="stat-label">Picks hit</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num">{stats.stamps}</div>
                <div className="stat-label">Stamps</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num">{stats.drinks}</div>
                <div className="stat-label">Pours</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="chip-row">
          {STAGES.map((s) => (
            <Link
              key={s.key || "all"}
              href={scheduleHref(view, s.key)}
              className={`chip ${activeStage === s.key ? "is-active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <ScheduleList items={items} emptyLead={view === "past" ? "Nothing in the books yet." : undefined} />
      </div>
    </>
  );
}
