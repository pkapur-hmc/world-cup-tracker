import Link from "next/link";
import {
  getMatchesList,
  getUpcomingPickableMatches,
  matchPhase,
  venueCity,
  type Match,
} from "@/lib/fixtures";
import { getCurrentMembership } from "@/lib/membership";
import { getUserPicksByMatch, getUserDrinkStatsByMatch, getUserStampedBeers } from "@/lib/picks";
import { getMemberStats } from "@/lib/stats";
import { beerNeedsFor } from "@/lib/beer-needs";
import { COUNTRY_BEERS } from "@/data/country-beers";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { countryName } from "@/data/country-names";
import { WccIcon } from "@/components/ui/CurrencyIcon";
import { BeerPlanList, type BeerPlanMatch } from "@/components/ui/BeerPlanList";
import { ScheduleList, type ScheduleItem } from "./ScheduleList";

type ScheduleView = "upcoming" | "past" | "beers";

const STAGES: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "group", label: "Group" },
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
];

function scheduleHref(view: ScheduleView, stage: string): string {
  const params = new URLSearchParams();
  if (view !== "upcoming") params.set("view", view);
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
  const view: ScheduleView =
    params.view === "past" ? "past" : params.view === "beers" ? "beers" : "upcoming";

  const member = await getCurrentMembership();

  let items: ScheduleItem[] = [];
  let beerPlan: BeerPlanMatch[] = [];
  let stats: Awaited<ReturnType<typeof getMemberStats>> | null = null;
  let picksCorrect = 0;
  let picksSettled = 0;

  if (view === "beers") {
    // Plan-ahead: the next matches with each side's still-needed beers. Capped
    // to a handful of upcoming matches so the page stays light (the list itself
    // also renders only the first couple of days).
    const [stampedBeers, upcoming] = await Promise.all([
      member ? getUserStampedBeers(member.userId) : Promise.resolve(new Map<string, Set<string>>()),
      getUpcomingPickableMatches(),
    ]);
    beerPlan = upcoming
      .slice(0, 24)
      .map((m) => {
        const teams = [m.team_a_code, m.team_b_code]
          .filter((c): c is string => !!c)
          .filter((code) => (COUNTRY_BEERS[code] ?? []).length > 0)
          .map((code) => {
            const needs = beerNeedsFor(code, stampedBeers.get(code));
            return {
              code,
              name: countryName(code),
              flag: FLAG_EMOJI[code] ?? "",
              needed: needs.needed.map((b) => b.name),
              total: needs.total,
              done: needs.done,
            };
          });
        return { id: m.id, kickoffAt: m.kickoff_at, teams };
      })
      .filter((m) => m.teams.length > 0);
  } else {
    const [matches, picksByMatch, drinksByMatch, s] = await Promise.all([
      getMatchesList(activeStage ? (activeStage as Match["stage"]) : undefined),
      member ? getUserPicksByMatch(member.userId) : Promise.resolve(new Map()),
      member && view === "past"
        ? getUserDrinkStatsByMatch(member.userId)
        : Promise.resolve(new Map<number, { drinks: number; wcc: number }>()),
      member && view === "past" ? getMemberStats("", member.userId) : Promise.resolve(null),
    ]);
    stats = s;

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
    if (view === "past") {
      for (const p of picksByMatch.values()) {
        if (!p.settled_at || p.payout_wcc > 0) continue; // pending or refunded
        picksSettled += 1;
        if (p.payout_wcp > 0) picksCorrect += 1;
      }
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
              : view === "beers"
                ? "Beers to line up before kickoff"
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
          <Link
            href={scheduleHref("beers", activeStage)}
            className={`seg-tab beers ${view === "beers" ? "is-active" : ""}`}
          >
            🍺 Beers
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
                <div className="stat-num">{stats.distinctBeers}</div>
                <div className="stat-label">Stamps</div>
              </div>
              <div className="stat-cell">
                <div className="stat-num">{stats.drinks}</div>
                <div className="stat-label">Pours</div>
              </div>
            </div>
          </div>
        ) : null}

        {view !== "beers" ? (
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
        ) : null}

        {view === "beers" ? (
          <BeerPlanList matches={beerPlan} maxDays={4} showHeader={false} />
        ) : (
          <ScheduleList items={items} emptyLead={view === "past" ? "Nothing in the books yet." : undefined} />
        )}
      </div>
    </>
  );
}
