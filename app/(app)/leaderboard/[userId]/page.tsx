import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { computeMemberStats, type DrinkRow, type PickRow } from "@/lib/scoring";
import { BackButton } from "@/components/ui/BackButton";
import { WccIcon } from "@/components/ui/CurrencyIcon";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [member, supabase] = await Promise.all([
    getCurrentMembership(),
    createClient(),
  ]);
  if (!member) notFound();

  // Resolve display name from the viewer's current bracket
  const { data: memberRow } = await supabase
    .from("wc_memberships")
    .select("display_name, role")
    .eq("group_id", member.groupId)
    .eq("user_id", userId)
    .single();
  if (!memberRow) notFound();

  const [{ data: drinks }, { data: picks }] = await Promise.all([
    supabase
      .from("wc_drinks")
      .select("match_id, country_code, beer_label")
      .eq("user_id", userId),
    supabase
      .from("wc_picks")
      .select("match_id, pick, stake, settled_at, payout_wcc, payout_wcp")
      .eq("user_id", userId),
  ]);

  const drinkRows = (drinks ?? []) as DrinkRow[];
  const pickRows = (picks ?? []) as PickRow[];
  const stats = computeMemberStats(drinkRows, pickRows);

  const settled = pickRows.filter((p) => p.settled_at);
  const picksCorrect = settled.filter((p) => p.payout_wcp > 0).length;
  const picksMade = settled.length;

  const isYou = userId === member.userId;
  const displayName = isYou ? "You" : memberRow.display_name;

  const statItems = [
    { label: "WCC", value: stats.wcc, icon: <WccIcon size={20} /> },
    { label: "Picks hit", value: `${picksCorrect}/${picksMade}`, icon: <span aria-hidden>🎯</span> },
    { label: "Stamps", value: stats.stamps, icon: <span aria-hidden>🛂</span> },
    { label: "Pours", value: stats.drinks, icon: <span aria-hidden>🍺</span> },
  ];

  return (
    <>
      <div className="appbar">
        <BackButton fallback="/leaderboard" />
        <div style={{ flex: 1 }}>
          <div className="caps-label">Player stats</div>
        </div>
      </div>

      <div className="screen" style={{ gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0" }}>
          <div
            className="avatar"
            style={{ width: 52, height: 52, fontSize: 22, flexShrink: 0 }}
          >
            {memberRow.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="t-h1">{displayName}</div>
            <div className="t-small muted">{member.groupName}</div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {statItems.map((s) => (
            <div
              key={s.label}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {s.icon}
                <span className="caps-label" style={{ fontSize: 10 }}>{s.label}</span>
              </div>
              <div className="t-display tnum" style={{ fontSize: 36, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {stats.passports > 0 ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span aria-hidden style={{ fontSize: 24 }}>🛂</span>
            <div>
              <div className="t-sub">{stats.passports} passport{stats.passports > 1 ? "s" : ""} complete</div>
              <div className="t-small muted">+{stats.passports * 5} WCC from depth bonuses</div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
