import Link from "next/link";
import { getMatchesList, venueCity, type Match } from "@/lib/fixtures";
import { getCurrentMembership } from "@/lib/membership";
import { getUserPicksByMatch } from "@/lib/picks";
import { ScheduleList, type MyPick, type ScheduleItem } from "./ScheduleList";

const STAGES: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "group", label: "Group" },
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const params = await searchParams;
  const activeStage = STAGES.find((s) => s.key === params.stage)?.key ?? "";

  const member = await getCurrentMembership();
  const [matches, picksByMatch] = await Promise.all([
    getMatchesList(activeStage ? (activeStage as Match["stage"]) : undefined),
    member ? getUserPicksByMatch(member.userId) : Promise.resolve(new Map<number, MyPick>()),
  ]);

  const items: ScheduleItem[] = matches.map((match) => ({
    match,
    myPick: picksByMatch.get(match.id) ?? null,
    city: venueCity(match.venue),
  }));

  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="t-h1">Schedule</div>
          <div className="t-small muted">
            {items.length} matches · Jun 11 - Jul 19
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 0 }}>
        <div className="chip-row">
          {STAGES.map((s) => (
            <Link
              key={s.key || "all"}
              href={s.key ? `/schedule?stage=${s.key}` : "/schedule"}
              className={`chip ${activeStage === s.key ? "is-active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <ScheduleList items={items} />
      </div>
    </>
  );
}
