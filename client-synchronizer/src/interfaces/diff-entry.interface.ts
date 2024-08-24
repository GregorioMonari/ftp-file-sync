import { FileSystemNode } from "../app/filesystem-tree/base/FileSystemNode";

export interface DiffEntry{
    node: FileSystemNode,
    type: "local-only"|"remote-only"|"local-changed"|"remote-changed"
}