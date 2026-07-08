import React, { useState } from "react";

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const HistoryPanel = ({ open, snapshots, busy, onSave, onRestore, onClose }) => {
  const [label, setLabel] = useState("");

  return (
    <aside className="ed-history-panel" style={{ width: open ? "320px" : "0px" }}>
      <div className="ed-col-header between">
        <span className="ed-col-title">🕘 Version History</span>
        <button className="ed-ai-close" onClick={onClose} aria-label="Close history">✕</button>
      </div>

      <div className="ed-hist-save">
        <input
          className="ed-input"
          placeholder="Name this version…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onSave(label.trim() || "Manual save"); setLabel(""); } }}
        />
        <button
          className="ed-hist-savebtn"
          disabled={busy}
          onClick={() => { onSave(label.trim() || "Manual save"); setLabel(""); }}
        >
          ＋ Save version
        </button>
      </div>

      <div className="ed-hist-list">
        {snapshots.length === 0 && (
          <div className="ed-hist-empty">No saved versions yet.<br />Save one to start your history.</div>
        )}
        {snapshots.map((s) => (
          <div key={s.id} className="ed-hist-item">
            <div className="ed-hist-meta">
              <span className="ed-hist-label">{s.label || "Untitled version"}</span>
              <span className="ed-hist-sub">{s.author || "Unknown"} · {timeAgo(s.createdAt)}</span>
            </div>
            <button
              className="ed-hist-restore"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Restore "${s.label || "this version"}"? Current unsaved changes will be replaced for everyone in the room.`)) {
                  onRestore(s.id);
                }
              }}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default HistoryPanel;
