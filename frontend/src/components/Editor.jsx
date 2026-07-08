import React, { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { githubLight } from "@uiw/codemirror-theme-github";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import { useTheme } from "../context/ThemeContext";
import { undoManagerFor } from "../features/collab/undo";

const buildExtension = (language) => {
  switch (language) {
    case "javascript":
      return javascript({ jsx: true });
    case "html":
      return html();
    case "css":
      return css();
    case "cpp":
      return cpp();
    case "python":
      return python();
    default:
      return javascript({ jsx: true });
  }
};

// Collaborative editor built on raw CodeMirror 6 (the canonical y-codemirror.next
// integration). The document is initialized from the Y.Text so existing content
// renders immediately, and yCollab owns all live sync + remote cursors. This
// avoids the controlled-value reconciliation of the React wrapper, which would
// otherwise revert collaborative edits.
const Editor = ({ language, onEditorMount, yText, awareness, onActivity }) => {
  const themeName = useTheme()?.theme || "dark";
  const hostRef = useRef(null);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  useEffect(() => {
    if (!yText || !hostRef.current) return undefined;

    const undoManager = undoManagerFor(yText);
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: yText.toString(),
        extensions: [
          basicSetup,
          buildExtension(language),
          themeName === "dark" ? okaidia : githubLight,
          EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto" } }),
          yCollab(yText, awareness, { undoManager }),
          // Yjs-aware undo/redo (Ctrl/Cmd+Z / Y) — takes precedence over CodeMirror's
          // native history so undo respects collaborative edits.
          Prec.high(keymap.of(yUndoManagerKeymap)),
          // Report local activity (edits + cursor moves) for presence analytics.
          EditorView.updateListener.of((update) => {
            const cb = onActivityRef.current;
            if (cb && (update.docChanged || update.selectionSet)) {
              cb({ docChanged: update.docChanged, cursorMoved: update.selectionSet });
            }
          }),
        ],
      }),
    });

    if (onEditorMount) onEditorMount(view);

    return () => {
      view.destroy(); // keep the cached UndoManager alive for per-file undo
    };
    // Re-create the view when the bound text, language, or theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yText, awareness, language, themeName]);

  return <div ref={hostRef} style={{ height: "100%" }} />;
};

export default React.memo(Editor);
