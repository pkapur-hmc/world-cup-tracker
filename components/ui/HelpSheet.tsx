"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { WccIcon, WcpIcon } from "@/components/ui/CurrencyIcon";

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
          Your <strong>drinking currency</strong>. Earn it by logging drinks during matches.
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
        <p className="muted">Spend WCC to stake on your picks - or just sit on the pile.</p>
      </Section>

      <Section
        title={
          <>
            <WcpIcon size={16} /> WCP <span className="muted t-small">- World Cup Points</span>
          </>
        }
      >
        <p>
          Your <strong>scoreboard currency</strong>. The leaderboard is built on these.
        </p>
        <ul>
          <li>
            Pick the winner of a match: <strong>+1 WCP</strong>
          </li>
          <li>
            Pick correctly with a stake of <em>X</em>: <strong>+{`1 + 2×X`}</strong> WCP (your X
            WCC stake is consumed)
          </li>
          <li>
            Logging a country beer also nets <strong>+1 WCP</strong>
          </li>
        </ul>
        <p className="muted">No pick on a match = no WCP from that match.</p>
      </Section>

      <Section title={<>📊 Total &amp; rank</>}>
        <p>
          Your <strong>Total = WCC + WCP</strong>. The leaderboard sorts on Total by default;
          tap a chip to sort by any column.
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
