import { FileNode, DirectoryNode } from "./base/FileSystemNode";
import { FileSystemVisitor } from "./base/FileSystemVisitor.interface";

export default class TotalSizeFSTVisitor implements FileSystemVisitor{
    private totalSize=0;

    visitFile(file: FileNode): void {
        this.totalSize=this.totalSize+file.data.size;
    }
    visitDirectory(directory: DirectoryNode): void {
        for(const fsNode of directory.getChildren().values()){
            fsNode.accept(this)
        }
    }
    getTotalSize(){
        return this.totalSize;
    }
    resetSize(){
        this.totalSize=0;
    }
}