import { DirectoryNode, FileNode } from "./FileSystemNode";

export interface FileSystemVisitor {
    visitFile(file: FileNode): Promise<void>;
    visitDirectory(directory: DirectoryNode): Promise<void>;
}