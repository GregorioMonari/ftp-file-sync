import { FileSystemNode } from "../lib/filesystem-tree-visitor/FileSystemNode";

export interface DiffEntry{
    node: FileSystemNode,
    type: "local-only"|"remote-only"|"local-changed"|"remote-changed"
}