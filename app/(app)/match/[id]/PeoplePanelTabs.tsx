"use client";

import { useState, type ReactNode } from "react";

/**
 * Top-bar switcher for the live "people" panel. Tab content is rendered
 * server-side and passed in as slots; inactive tabs stay MOUNTED (hidden, not
 * unmounted) so WatchingNow's presence ping + 10s polling keep running while
 * the picks tab is up.
 */
export function PeoplePanelTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div role="tablist" className="seg-tabs" style={{ marginBottom: 8 }}>
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              className={`seg-tab ${selected ? "is-active" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
