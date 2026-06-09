/**
 * Generic skeleton shown during navigation between (app) routes. Next.js
 * renders this immediately on tab change while the destination page's server
 * components fetch + render in the background, so the bottom-tab nav feels
 * snappy instead of blank.
 */
export default function AppLoading() {
  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="skel skel-title" />
          <div className="skel skel-sub" />
        </div>
      </div>

      <div className="screen" style={{ gap: 12 }}>
        <div className="card skel-card" style={{ height: 130 }} />
        <div className="card skel-card" style={{ height: 110 }} />
        <div className="card skel-card" style={{ height: 90 }} />
        <div className="card skel-card" style={{ height: 60 }} />
      </div>
    </>
  );
}
