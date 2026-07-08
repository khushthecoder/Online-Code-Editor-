import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getTreeMap,
  getFilesMap,
  nodesOf,
  buildTree,
  createNode,
  renameNode,
  moveNode,
  deleteNode,
} from "./project";

// Reactive view of the shared project tree + bound mutation helpers.
export function useProject(ydoc) {
  const treeMap = useMemo(() => getTreeMap(ydoc), [ydoc]);
  const filesMap = useMemo(() => getFilesMap(ydoc), [ydoc]);
  const [nodes, setNodes] = useState(() => nodesOf(treeMap));

  useEffect(() => {
    const update = () => setNodes(nodesOf(treeMap));
    update();
    treeMap.observe(update);
    return () => treeMap.unobserve(update);
  }, [treeMap]);

  // Rebuild the sorted nested tree whenever the flat node set changes.
  const tree = useMemo(() => buildTree(treeMap), [nodes, treeMap]);

  const createFile = useCallback((parentId, name) => createNode(ydoc, { name, parentId, type: "file" }), [ydoc]);
  const createFolder = useCallback((parentId, name) => createNode(ydoc, { name, parentId, type: "folder" }), [ydoc]);
  const rename = useCallback((id, name) => renameNode(ydoc, id, name), [ydoc]);
  const move = useCallback((id, parentId) => moveNode(ydoc, id, parentId), [ydoc]);
  const remove = useCallback((id) => deleteNode(ydoc, id), [ydoc]);

  return { treeMap, filesMap, nodes, tree, createFile, createFolder, rename, move, remove };
}
