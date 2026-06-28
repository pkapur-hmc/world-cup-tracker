"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { WccIcon } from "@/components/ui/CurrencyIcon";

/**
 * "How to play" sheet. One canonical explanation of the game so we can link
 * here from anywhere (settings, app bars, in-context ?'s) without duplicating
 * copy across surfaces.
 */
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="How the Cup works">
      <Section
        title={
          <>
            <WccIcon size={16} /> WCC <span className="muted t-small">- World Cup Cups</span>
          </>
        }
      >
        <p>
          The <strong>one currency</strong>. It&apos;s your balance, your score, and what
          ranks the leaderboard. Earn it by logging drinks during matches and by
          calling winners.
        </p>
        <ul>
          <li>
            <strong>Basic drink</strong> (anything goes): <strong>+1 WCC</strong>
          </li>
          <li>
            <strong>Country beer</strong> (Modelo while Mexico plays, etc.): <strong>+2 WCC</strong>{" "}
            and a passport stamp 🛂
          </li>
        </ul>
        <p className="muted">Sit on your pile, or stake it on picks to win more.</p>
      </Section>

      <Section title={<>🛂 Passport bonuses</>}>
        <p>
          Your stamps stack into two bonuses - one for going <strong>wide</strong>,
          one for going <strong>deep</strong>:
        </p>
        <ul>
          <li>
            🌍 <strong>Breadth</strong> - stamp a beer from <strong>5 different
            countries</strong>: <strong>+5 WCC</strong>, and again every 5 after that
          </li>
          <li>
            🏅 <strong>Depth</strong> - stamp <strong>every</strong> beer on one
            country&apos;s list: <strong>+5 WCC</strong>, per country
          </li>
        </ul>
        <p className="muted">
          Both are on top of the +2 per beer. Track it all on the Passport tab.
        </p>
      </Section>

      <Section title={<>🎯 Picks &amp; stakes</>}>
        <p>
          Predict a match winner. <strong>Stake</strong> some of your WCC to win more.
        </p>
        <ul>
          <li>
            Pick the winner with no stake: <strong>+1 WCC</strong> if right
          </li>
          <li>
            Pick correctly with a stake of <em>X</em>: <strong>+{`1 + 2×X`}</strong> WCC (your
            X-cup stake is spent either way)
          </li>
          <li>
            Wrong pick: you just lose the stake. No pick = nothing won or lost.
          </li>
        </ul>
        <p className="muted">You can stake any WCC you have, including winnings.</p>
      </Section>

      <Section title={<>🔥 Comeback multiplier</>}>
        <p>
          The further <strong>behind the leader</strong> you are, the more your
          drinking pays - so a rough run is recoverable. It only ever <em>adds</em>;
          the leader is never penalized.
        </p>
        <ul>
          <li>
            <strong>Country beers</strong> scale up to <strong>×10</strong> (a +2 beer
            worth up to +20)
          </li>
          <li>
            <strong>Passport bonuses</strong> scale up to <strong>×5</strong> (up to +25)
          </li>
          <li>
            <strong>Correct picks</strong> pay up to <strong>×2</strong> - your rate is
            locked in when you place the bet
          </li>
        </ul>
        <p className="muted">
          Your rate is set by your score vs. the leader and eases off as you climb.
          Basic drinks stay +1.
        </p>
      </Section>

      <Section title={<>⚖️ Knockout reset</>}>
        <p>
          Once, before the knockout rounds, runaway leads get <strong>squeezed toward
          the pack</strong> - leaders keep a head start, but it&apos;s catchable. Only
          the points move; your drinks and stamps are never touched.
        </p>
      </Section>

      <Section title={<>🏆 Multiple brackets</>}>
        <p>
          You can be in <strong>any number of brackets</strong> at once. Your
          drinks &amp; stamps count in <em>all</em> of them - track once, your numbers
          show up everywhere.
        </p>
        <p className="muted">
          Picks &amp; stakes are per-bracket (you can pick differently in each).
          Switch brackets from Settings or via the dropdown on the Leaderboard.
        </p>
      </Section>

      <Section title={<>🤝 Inviting friends</>}>
        <p>
          Share your bracket&apos;s invite link from <strong>Settings → Share invite</strong>.
          Anyone with the link can join. You can be in as many brackets as you want, and your
          drinks &amp; stamps count in all of them.
        </p>
      </Section>

      <Section title={<>🔒 Locking</>}>
        <p>
          Picks and stakes lock at <strong>kickoff</strong>. After that, drinks can still be
          logged (and removed) but the pick is fixed.
        </p>
      </Section>

      <button type="button" className="btn primary block" onClick={onClose} style={{ marginTop: 6 }}>
        Got it
      </button>
    </BottomSheet>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div
        className="t-sub"
        style={{ fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}
      >
        {title}
      </div>
      <div className="help-prose">{children}</div>
    </div>
  );
}
