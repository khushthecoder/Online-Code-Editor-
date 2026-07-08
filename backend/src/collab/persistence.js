const crypto = require("crypto");
const Y = require("yjs");
const prisma = require("../prismaClient");

const SAVE_DEBOUNCE_MS = 2500;
const saveTimers = new Map(); // docName -> timeout

// ── P1 project model (mirrors frontend features/collab/project.js) ──────────
//   files : Y.Map<fileId, Y.Text>            content by stable id
//   tree  : Y.Map<nodeId, {id,name,parentId,type}>   structure
const codeTextName = (lang) => `code:${lang}`;
const LEGACY_TO_FILE = { python: "main.py", javascript: "main.js", cpp: "main.cpp" };

async function loadStored(docName) {
  const row = await prisma.collabDoc.findUnique({ where: { roomId: docName } });
  return row ? new Uint8Array(row.state) : null;
}

function addFile(ydoc, name, content) {
  const id = crypto.randomUUID();
  ydoc.getMap("tree").set(id, { id, name, parentId: null, type: "file" });
  const text = new Y.Text();
  if (content) text.insert(0, content);
  ydoc.getMap("files").set(id, text);
  return id;
}

// Ensure the doc has a project (files+tree). Runs once per room: on a brand-new
// room it seeds a starter project; on a legacy P0 room it migrates the
// code:<lang> buffers into files so no content is lost. Idempotent.
async function ensureProject(docName, ydoc) {
  const tree = ydoc.getMap("tree");
  if (tree.size > 0) return false; // already a P1 project

  ydoc.transact(() => {
    // 1) migrate legacy CRDT code:<lang> buffers that already have content
    let migrated = false;
    for (const [lang, file] of Object.entries(LEGACY_TO_FILE)) {
      const legacy = ydoc.getText(codeTextName(lang));
      if (legacy.length > 0) {
        addFile(ydoc, file, legacy.toString());
        migrated = true;
      }
    }
    if (migrated) return;

    // 2) default starter project for brand-new rooms
    addFile(ydoc, "main.py", 'print("Hello, CompileX!")\n');
    addFile(ydoc, "README.md", "# My Project\n\nWelcome to your collaborative IDE.\n");
  });
  return true;
}

// Pull any legacy Code-table columns into the doc's code:<lang> buffers (so the
// subsequent ensureProject migration picks them up for very old rooms).
async function seedLegacyCodeTable(docName, ydoc) {
  let code = null;
  try {
    const room = await prisma.room.findUnique({
      where: { roomId: docName },
      select: { code: true },
    });
    code = room?.code || null;
  } catch (e) {
    /* room may not exist yet */
  }
  if (!code) return;
  ydoc.transact(() => {
    for (const lang of Object.keys(LEGACY_TO_FILE)) {
      const t = ydoc.getText(codeTextName(lang));
      if (code[lang] && t.length === 0) t.insert(0, code[lang]);
    }
  });
}

async function persist(docName, ydoc) {
  const update = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  await prisma.collabDoc.upsert({
    where: { roomId: docName },
    update: { state: update },
    create: { roomId: docName, state: update },
  });
}

function scheduleSave(docName, ydoc) {
  if (saveTimers.has(docName)) clearTimeout(saveTimers.get(docName));
  saveTimers.set(
    docName,
    setTimeout(() => {
      saveTimers.delete(docName);
      persist(docName, ydoc).catch((e) =>
        console.error(`[collab] save failed for ${docName}:`, e.message),
      );
    }, SAVE_DEBOUNCE_MS),
  );
}

// Called when a room's shared doc is created: hydrate it, ensure a project
// exists, then keep it persisted.
async function bindState(docName, ydoc) {
  try {
    const stored = await loadStored(docName);
    if (stored) {
      Y.applyUpdate(ydoc, stored);
    } else {
      await seedLegacyCodeTable(docName, ydoc); // very old rooms: Code table -> code:<lang>
    }
    const changed = await ensureProject(docName, ydoc); // seed/migrate into files+tree
    if (!stored || changed) await persist(docName, ydoc);
  } catch (e) {
    console.error(`[collab] bindState error for ${docName}:`, e.message);
  }
  ydoc.on("update", () => scheduleSave(docName, ydoc));
}

// Called when the last client leaves: flush immediately.
async function writeState(docName, ydoc) {
  if (saveTimers.has(docName)) {
    clearTimeout(saveTimers.get(docName));
    saveTimers.delete(docName);
  }
  try {
    await persist(docName, ydoc);
  } catch (e) {
    console.error(`[collab] writeState error for ${docName}:`, e.message);
  }
}

module.exports = { bindState, writeState };
