import * as Y from "yjs";

// ── Y.Doc project model ─────────────────────────────────────────────────────
//   files : Y.Map<fileId, Y.Text>                  content, keyed by STABLE id
//   tree  : Y.Map<nodeId, {id,name,parentId,type}> structure (parentId=null → root)
// Rename/move only touch the tree node; content (Y.Text) never moves → concurrent
// edits during rename/move are safe.
export const ROOT = null;
export const getFilesMap = (ydoc) => ydoc.getMap("files");
export const getTreeMap = (ydoc) => ydoc.getMap("tree");
export const newId = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

// ── Language + icon detection from extension ────────────────────────────────
const ext = (name) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

// CodeMirror grammar (only the grammars we ship; others → plaintext).
const CM_LANG = {
  py: "python",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "javascript", tsx: "javascript", json: "javascript",
  cpp: "cpp", cc: "cpp", cxx: "cpp", c: "cpp", h: "cpp", hpp: "cpp",
  html: "html", htm: "html", css: "css",
};
export const cmLanguageFor = (name) => CM_LANG[ext(name)] || "javascript";

// Runnable language for the Run endpoint (python/javascript/cpp/java), else null.
const RUN_LANG = {
  py: "python",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  cpp: "cpp", cc: "cpp", cxx: "cpp", c: "cpp",
  java: "java",
};
export const runLanguageFor = (name) => RUN_LANG[ext(name)] || null;

const ICONS = {
  py: "🐍", js: "📜", jsx: "⚛️", mjs: "📜", cjs: "📜", ts: "🔷", tsx: "⚛️",
  json: "🧾", md: "📝", html: "🌐", htm: "🌐", css: "🎨",
  cpp: "🔵", cc: "🔵", c: "🔵", h: "🔵", hpp: "🔵", java: "☕", txt: "📄",
};
export const iconFor = (node) =>
  node.type === "folder" ? "📁" : ICONS[ext(node.name)] || "📄";

// ── Name validation (security: no traversal / illegal chars / oversize) ─────
const ILLEGAL = /[\\/:*?"<>|]/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1F]/;
export function validateName(name) {
  const n = (name || "").trim();
  if (!n) return { ok: false, error: "Name cannot be empty" };
  if (n.length > 100) return { ok: false, error: "Name too long (max 100)" };
  if (n === "." || n === "..") return { ok: false, error: "Invalid name" };
  if (ILLEGAL.test(n) || CONTROL.test(n)) return { ok: false, error: "Illegal characters in name" };
  return { ok: true, value: n };
}

const MAX_DEPTH = 20;

// ── Read helpers ────────────────────────────────────────────────────────────
export const nodesOf = (treeMap) => Array.from(treeMap.values());

export function pathOf(treeMap, id) {
  const parts = [];
  let cur = treeMap.get(id);
  let guard = 0;
  while (cur && guard++ < MAX_DEPTH + 5) {
    parts.unshift(cur.name);
    cur = cur.parentId ? treeMap.get(cur.parentId) : null;
  }
  return parts.join("/");
}

function depthOf(treeMap, parentId) {
  let d = 0;
  let cur = parentId ? treeMap.get(parentId) : null;
  while (cur && d < MAX_DEPTH + 5) {
    d++;
    cur = cur.parentId ? treeMap.get(cur.parentId) : null;
  }
  return d;
}

// Is `maybeAncestorId` an ancestor of (or equal to) `id`? Used to block cycles.
function isAncestor(treeMap, id, maybeAncestorId) {
  let cur = treeMap.get(id);
  let guard = 0;
  while (cur && guard++ < MAX_DEPTH + 5) {
    if (cur.id === maybeAncestorId) return true;
    cur = cur.parentId ? treeMap.get(cur.parentId) : null;
  }
  return false;
}

// Build a sorted nested tree (folders first, then alphabetical) for rendering.
export function buildTree(treeMap) {
  const byParent = new Map();
  for (const node of treeMap.values()) {
    const key = node.parentId || "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const sort = (a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  };
  const build = (parentKey) =>
    (byParent.get(parentKey) || [])
      .sort(sort)
      .map((n) => ({ ...n, children: n.type === "folder" ? build(n.id) : undefined }));
  return build("__root__");
}

// ── Mutations (all inside a transaction for atomicity) ──────────────────────
export function createNode(ydoc, { name, parentId = ROOT, type }) {
  const v = validateName(name);
  if (!v.ok) return { error: v.error };
  const tree = getTreeMap(ydoc);
  if (depthOf(tree, parentId) >= MAX_DEPTH) return { error: "Folder nesting too deep" };
  const id = newId();
  ydoc.transact(() => {
    tree.set(id, { id, name: v.value, parentId: parentId || null, type });
    if (type === "file") getFilesMap(ydoc).set(id, new Y.Text());
  });
  return { id };
}

export function renameNode(ydoc, id, name) {
  const v = validateName(name);
  if (!v.ok) return { error: v.error };
  const tree = getTreeMap(ydoc);
  const node = tree.get(id);
  if (!node) return { error: "Not found" };
  tree.set(id, { ...node, name: v.value });
  return { ok: true };
}

export function moveNode(ydoc, id, newParentId) {
  const tree = getTreeMap(ydoc);
  const node = tree.get(id);
  if (!node) return { error: "Not found" };
  const parentId = newParentId || null;
  if (parentId === node.parentId) return { ok: true };
  if (parentId && isAncestor(tree, parentId, id)) {
    return { error: "Cannot move a folder into itself" };
  }
  if (parentId) {
    const p = tree.get(parentId);
    if (!p || p.type !== "folder") return { error: "Target is not a folder" };
  }
  tree.set(id, { ...node, parentId });
  return { ok: true };
}

export function deleteNode(ydoc, id) {
  const tree = getTreeMap(ydoc);
  const files = getFilesMap(ydoc);
  // collect the subtree (folder + all descendants)
  const toDelete = [];
  const walk = (nid) => {
    toDelete.push(nid);
    for (const n of tree.values()) if (n.parentId === nid) walk(n.id);
  };
  walk(id);
  ydoc.transact(() => {
    for (const nid of toDelete) {
      tree.delete(nid);
      if (files.has(nid)) files.delete(nid);
    }
  });
  return { deleted: toDelete };
}
