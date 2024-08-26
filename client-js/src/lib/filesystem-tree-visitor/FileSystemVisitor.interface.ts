import { DirectoryNode, FileNode } from "./FileSystemNode";

export interface FileSystemVisitor {
    visitFile(file: FileNode): void;
    visitDirectory(directory: DirectoryNode): void;
}