import { DirectoryNode, FileNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";

export default class PrintFSTreeVisitor implements FileSystemVisitor{
    
    private currentIndentationLevel:number=0; //-1 e non 0 perchè la la prima visit è a una directory

    getIndentation(){
        let ind="";
        for(let i=0; i<this.currentIndentationLevel; i++){
            ind=ind+" "
        }
        return ind;
    }

    visitFile(file: FileNode): void {
        console.log(this.getIndentation()+file.name+ ` ${file.data.size}`)
    }
    
    visitDirectory(directory: DirectoryNode): void {
        if(directory.name==""){
            console.log("root")
        }else{
            console.log(this.getIndentation()+directory.name+ ` ${directory.data.size}`)
        }
        this.currentIndentationLevel++;
        for(const fsNode of directory.getChildren().values()){
            fsNode.accept(this)
        }
        this.currentIndentationLevel--;
    }
}