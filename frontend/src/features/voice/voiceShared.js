import { useEffect } from "react";

// Shared voice-control logic used identically by the mesh and LiveKit hooks.
// Extracted verbatim to remove duplication — no behavior change.

export const DEVICE_KEY = "voice:micDeviceId";
export const PTT_KEY = "Backquote"; // hold ` to talk (ignored while typing in the editor)

// Whether the mic should be transmitting right now, given mute + push-to-talk.
export function shouldTransmit({ pttMode, pttHeld, muted }) {
  return pttMode ? pttHeld && !muted : !muted;
}

// Enumerate audio-input devices → [{deviceId,label}]. Returns null on failure so
// callers can leave the current device list unchanged (matches prior behavior).
export async function listMics() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
  } catch {
    return null;
  }
}

// Keyboard push-to-talk. Active only while in voice + PTT mode; ignored while an
// editable field (the CodeMirror editor, chat, etc.) is focused so it never
// hijacks a real keystroke.
export function usePttKeyboard({ enabled, inVoice, pttMode, pttDown, pttUp }) {
  useEffect(() => {
    if (!enabled || !inVoice || !pttMode) return undefined;
    const editable = (el) =>
      el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const down = (e) => {
      if (e.code !== PTT_KEY || e.repeat || editable(document.activeElement)) return;
      e.preventDefault();
      pttDown();
    };
    const up = (e) => {
      if (e.code !== PTT_KEY || editable(document.activeElement)) return;
      pttUp();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled, inVoice, pttMode, pttDown, pttUp]);
}
