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

    async visitFile(file: FileNode): Promise<void> {
        console.log(this.getIndentation()+file.name+ ` ${file.data.size} ${file.data.mtime}`)
    }
    
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        if(directory.name==""){
            console.log("root")
        }else{
            console.log(this.getIndentation()+directory.name+ ` ${directory.data.size} ${directory.data.mtime}`)
        }
        this.currentIndentationLevel++;
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
        this.currentIndentationLevel--;
    }
}