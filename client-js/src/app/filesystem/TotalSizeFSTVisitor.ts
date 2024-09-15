import { FileNode, DirectoryNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";

export default class TotalSizeFSTVisitor implements FileSystemVisitor{
    private totalSize=0;

    async visitFile(file: FileNode): Promise<void> {
        this.totalSize=this.totalSize+file.data.size;
    }
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
    }
    getTotalSize(){
        return this.totalSize;
    }
    resetSize(){
        this.totalSize=0;
    }
}