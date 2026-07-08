import * as Y from "yjs";

// One UndoManager per Y.Text, cached so per-file undo history survives editor
// view recreation (on file/language/theme switch). Shared by the Editor (for the
// keymap) and the toolbar Undo/Redo buttons so they operate on the same stack.
const cache = new WeakMap();

export function undoManagerFor(yText) {
  let um = cache.get(yText);
  if (!um) {
    um = new Y.UndoManager(yText);
    cache.set(yText, um);
  }
  return um;
}
