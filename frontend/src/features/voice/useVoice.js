import { useEffect, useState } from "react";
import api from "../../services/api";
import { useMeshVoice } from "./useMeshVoice";
import { useLivekitVoice } from "./useLivekitVoice";

// ── Voice provider seam ──────────────────────────────────────────────────────
// The transport is chosen by the server (/api/voice/config): LiveKit SFU when it's
// configured (large rooms, server active-speaker, mobile reliability), otherwise
// the built-in WebRTC mesh (zero-config, $0). Both hooks expose the IDENTICAL
// interface, so the editor UI is completely unaware of which one is live.
//
// Rules of hooks: we can't call a hook conditionally, so BOTH run every render —
// but each is gated by `enabled`, so the inactive one holds no mic, sockets, or
// connections. We return whichever matches the resolved mode.
export function useVoice({ roomId }) {
  const [mode, setMode] = useState("mesh"); // optimistic default; corrected from server

  useEffect(() => {
    let alive = true;
    api.get("/api/voice/config")
      .then(({ data }) => { if (alive && (data?.mode === "livekit" || data?.mode === "mesh")) setMode(data.mode); })
      .catch(() => { if (alive) setMode("mesh"); });
    return () => { alive = false; };
  }, [roomId]);

  const mesh = useMeshVoice({ roomId, enabled: mode === "mesh" });
  const livekit = useLivekitVoice({ roomId, enabled: mode === "livekit" });

  return mode === "livekit" ? livekit : mesh;
}
