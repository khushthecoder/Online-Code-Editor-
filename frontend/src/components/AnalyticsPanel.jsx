import React from "react";
import { usePresenceAnalytics } from "../features/collab/usePresenceAnalytics";

function fmtDur(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const timelineText = (e) =>
  e.type === "join" ? `${e.name} joined`
    : e.type === "leave" ? `${e.name} left`
      : `${e.name} opened ${e.file}`;

const AnalyticsPanel = ({ open, awareness, onClose }) => {
  // Aggregation state lives HERE (not in EditorPage) so its frequent re-renders
  // stay contained to this panel. The panel is always mounted, so timeline history
  // is preserved across open/close.
  const { analytics, timeline } = usePresenceAnalytics({ awareness });
  const a = analytics;
  return (
    <aside className="ed-analytics-panel" style={{ width: open ? "320px" : "0px" }}>
      <div className="ed-col-header between">
        <span className="ed-col-title">📊 Collaboration</span>
        <button className="ed-ai-close" onClick={onClose} aria-label="Close analytics">✕</button>
      </div>

      <div className="ed-an-body">
        {/* stat tiles */}
        <div className="ed-an-tiles">
          <div className="ed-an-tile"><span className="v">{a.onlineCount}</span><span className="k">Online</span></div>
          <div className="ed-an-tile"><span className="v">{a.idleCount}</span><span className="k">Idle</span></div>
          <div className="ed-an-tile"><span className="v">{a.activeEditors.length}</span><span className="k">Editing now</span></div>
          <div className="ed-an-tile"><span className="v">{a.totalEdits}</span><span className="k">Total edits</span></div>
        </div>

        {a.mostActiveFile && (
          <div className="ed-an-highlight">
            <span className="lbl">Most active file</span>
            <span className="val">{a.mostActiveFile}</span>
          </div>
        )}

        {/* users */}
        <div className="ed-an-section">People</div>
        {a.users.length === 0 && <div className="ed-an-empty">No one here yet.</div>}
        {a.users.map((u) => (
          <div className="ed-an-user" key={u.clientId}>
            <span className="dot" style={{ background: u.color }} />
            <div className="meta">
              <span className="name">
                {u.name}
                {u.active && !u.idle && <span className="tag editing">editing</span>}
                {u.idle && <span className="tag idle">idle</span>}
              </span>
              <span className="sub">
                {fmtDur(u.sessionSec)} · {u.edits} edits · {u.cursorMoves} moves
                {u.activeFile ? ` · ${u.activeFile}` : ""}
              </span>
            </div>
          </div>
        ))}

        {/* recently edited files */}
        {a.recentFiles.length > 0 && (
          <>
            <div className="ed-an-section">Recently edited</div>
            {a.recentFiles.map((f) => (
              <div className="ed-an-file" key={f.file}>
                <span className="fname">{f.file}</span>
                <span className="fcount">{f.edits}</span>
              </div>
            ))}
          </>
        )}

        {/* timeline */}
        <div className="ed-an-section">Activity timeline</div>
        {timeline.length === 0 && <div className="ed-an-empty">Nothing yet.</div>}
        {timeline.map((e) => (
          <div className="ed-an-event" key={e.id}>
            <span className={`ev-dot ${e.type}`} />
            <span className="ev-text">{timelineText(e)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default AnalyticsPanel;
