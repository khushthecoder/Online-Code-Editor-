import React, { useState, useEffect, useRef, useCallback } from "react";
import { iconFor } from "../features/collab/project";

// Inline text input used for create + rename. Commits on Enter/blur, cancels on Escape.
const InlineInput = ({ initial = "", onCommit, onCancel }) => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="ft-input"
      defaultValue={initial}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(e.target.value);
        else if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => onCommit(e.target.value)}
    />
  );
};

const FileTree = ({
  tree,
  activeId,
  onOpen,
  onCreateFile,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
}) => {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [creating, setCreating] = useState(null); // { parentId, type }
  const [menu, setMenu] = useState(null); // { x, y, node }
  const [dragOver, setDragOver] = useState(null); // folder id or "__root__"

  const closeMenu = useCallback(() => setMenu(null), []);
  useEffect(() => {
    if (!menu) return undefined;
    const h = () => closeMenu();
    window.addEventListener("click", h);
    window.addEventListener("scroll", h, true);
    return () => {
      window.removeEventListener("click", h);
      window.removeEventListener("scroll", h, true);
    };
  }, [menu, closeMenu]);

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const beginCreate = (parentId, type) => {
    if (parentId) setCollapsed((p) => { const n = new Set(p); n.delete(parentId); return n; });
    setCreating({ parentId, type });
    setMenu(null);
  };

  const commitCreate = (name) => {
    if (!creating) return;
    const trimmed = (name || "").trim();
    if (trimmed) {
      const res = creating.type === "file"
        ? onCreateFile(creating.parentId, trimmed)
        : onCreateFolder(creating.parentId, trimmed);
      if (res?.error) window.alert(res.error);
    }
    setCreating(null);
  };

  const commitRename = (id, name) => {
    const trimmed = (name || "").trim();
    if (trimmed) {
      const res = onRename(id, trimmed);
      if (res?.error) window.alert(res.error);
    }
    setRenamingId(null);
  };

  // ── Drag & drop ──
  const onDropTo = (parentId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/node-id");
    if (id) {
      const res = onMove(id, parentId);
      if (res?.error) window.alert(res.error);
    }
  };

  const renderNode = (node, depth) => {
    const isFolder = node.type === "folder";
    const isCollapsed = collapsed.has(node.id);
    const isActive = node.id === activeId;
    const pad = 8 + depth * 14;

    return (
      <div key={node.id}>
        <div
          className={`ft-row ${isActive ? "active" : ""} ${dragOver === node.id ? "dropzone" : ""}`}
          style={{ paddingLeft: pad }}
          draggable={renamingId !== node.id}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("text/node-id", node.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={isFolder ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(node.id); } : undefined}
          onDragLeave={isFolder ? () => setDragOver(null) : undefined}
          onDrop={isFolder ? onDropTo(node.id) : undefined}
          onClick={() => (isFolder ? toggle(node.id) : onOpen(node.id))}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, node }); }}
          title={node.name}
        >
          <span className="ft-chevron">{isFolder ? (isCollapsed ? "▸" : "▾") : ""}</span>
          <span className="ft-icon">{iconFor(node)}</span>
          {renamingId === node.id ? (
            <InlineInput
              initial={node.name}
              onCommit={(v) => commitRename(node.id, v)}
              onCancel={() => setRenamingId(null)}
            />
          ) : (
            <span className="ft-name">{node.name}</span>
          )}
        </div>

        {isFolder && !isCollapsed && (
          <div>
            {creating && creating.parentId === node.id && (
              <div className="ft-row" style={{ paddingLeft: pad + 14 }}>
                <span className="ft-chevron" />
                <span className="ft-icon">{creating.type === "folder" ? "📁" : "📄"}</span>
                <InlineInput onCommit={commitCreate} onCancel={() => setCreating(null)} />
              </div>
            )}
            {(node.children || []).map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ft">
      <div className="ft-header">
        <span className="ft-title">Explorer</span>
        <div className="ft-actions">
          <button className="ft-iconbtn" title="New File" onClick={() => beginCreate(null, "file")}>＋📄</button>
          <button className="ft-iconbtn" title="New Folder" onClick={() => beginCreate(null, "folder")}>＋📁</button>
        </div>
      </div>

      <div
        className={`ft-body ${dragOver === "__root__" ? "dropzone" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver("__root__"); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={onDropTo(null)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, node: null }); }}
      >
        {creating && creating.parentId === null && (
          <div className="ft-row" style={{ paddingLeft: 8 }}>
            <span className="ft-chevron" />
            <span className="ft-icon">{creating.type === "folder" ? "📁" : "📄"}</span>
            <InlineInput onCommit={commitCreate} onCancel={() => setCreating(null)} />
          </div>
        )}
        {tree.map((n) => renderNode(n, 0))}
        {tree.length === 0 && !creating && (
          <div className="ft-empty">No files yet. Use ＋ to create one.</div>
        )}
      </div>

      {menu && (
        <div className="ft-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => beginCreate(menu.node?.type === "folder" ? menu.node.id : null, "file")}>New File</button>
          <button onClick={() => beginCreate(menu.node?.type === "folder" ? menu.node.id : null, "folder")}>New Folder</button>
          {menu.node && <div className="ft-sep" />}
          {menu.node && <button onClick={() => { setRenamingId(menu.node.id); setMenu(null); }}>Rename</button>}
          {menu.node && (
            <button
              className="danger"
              onClick={() => {
                if (window.confirm(`Delete "${menu.node.name}"${menu.node.type === "folder" ? " and its contents" : ""}?`)) {
                  onDelete(menu.node.id);
                }
                setMenu(null);
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileTree;
