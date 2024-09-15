import { FileSystemNode } from "../lib/filesystem-tree-visitor/FileSystemNode";

export interface DiffEntry{
    localNode?: FileSystemNode;
    remoteNode?: FileSystemNode;
    type: "local-only"|"remote-only"|"changed";
}