import { DiffEntry } from "../../interfaces/diff-entry.interface";
import { FSEntry } from "../../lib/filesystem-tree-visitor/fs-entry.interface";
import { DirectoryNode, FileNode, FileSystemNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";



export default class ComparisonFSTreeVisitor implements FileSystemVisitor{
    private currCompareDir:DirectoryNode;
    private diffList:DiffEntry[]=[];
    constructor(private treeToCompare:DirectoryNode){
        this.currCompareDir=treeToCompare;
    }
    getDiffList(){
        return this.diffList;
    }
    visitFile(file: FileNode): void {
        //If we are here, both files exists. Now check for modifications or conflicts!
        const fileToCompare= this.currCompareDir.getChildren().get(file.name) as FileNode;
        console.log("checking file1: "+file.name+", file2: "+fileToCompare.name)

        //local time < remote time di base. Se è > allora abbiamo modifiche in locale SICURO
        if(file.data.mtime>fileToCompare.data.mtime){
            console.log("found local-changed file: "+file.name+", times:",file.data.mtime,fileToCompare.data.mtime)
            this.diffList.push({node:file,type:"local-changed"});
        }else{
            if(file.data.size!=fileToCompare.data.size){
                //TODO: SHOULD COMPARE FILE LINE BY LINE
                console.log("found remote-changed file: "+fileToCompare.name)
                //throw new Error("Conflict found between local and remote file, TBI: "+fileToCompare.name)
                this.diffList.push({node:fileToCompare,type:"remote-changed"});
            }else{
                //TODO: WHAT DO WE DO FOR SAME SIZE FILES? 
            }
        }
    }
    visitDirectory(directory: DirectoryNode): void {
        console.log("checking dir1: "+(directory.name?directory.name:"root")+", dir2: "+(this.currCompareDir.name?this.currCompareDir.name:"root"))
        //If we are here, both trees have this directory. Compare contents
        for(const fsNode of directory.getChildren().values()){
            if(this.currCompareDir.getChildren().has(fsNode.name)){
                if(fsNode.data.isDirectory){
                    const oldDir= this.currCompareDir;
                    this.currCompareDir=this.currCompareDir.getChildren().get(fsNode.name) as DirectoryNode;
                    fsNode.accept(this); //explore subdir
                    this.currCompareDir=oldDir;
                }else{
                    fsNode.accept(this) //compare files
                }
            }else{
                if(fsNode.data.isDirectory){
                    //*EXPLORE LOCAL ONLY DIRECTORY
                    const stDiffVisitor= new SingleTreeDiffVisitor('local-only');
                    fsNode.accept(stDiffVisitor)
                    this.diffList= this.diffList.concat(stDiffVisitor.getDiffList())
                }else{
                    //*Add local-only file to diff, no exploration needed
                    console.log("found local-only file "+fsNode.name)
                    this.diffList.push({node:fsNode,type:'local-only'});
                }
            }
        }
        //Now, check for remote-only
        for(const remoteFsNode of this.currCompareDir.getChildren().values()){
            if(!directory.getChildren().has(remoteFsNode.name)){
                if(remoteFsNode.data.isDirectory){
                    //*EXPLORE REMOTE ONLY DIRECTORY
                    const stDiffVisitor= new SingleTreeDiffVisitor('remote-only');
                    remoteFsNode.accept(stDiffVisitor)
                    this.diffList= this.diffList.concat(stDiffVisitor.getDiffList())
                }else{
                    //*Add remote-only file to diff, no exploration needed
                    console.log("found remote-only file "+remoteFsNode.name)
                    this.diffList.push({node:remoteFsNode,type:'remote-only'});
                }
            }
        }
    }
}


class SingleTreeDiffVisitor implements FileSystemVisitor{
    private diffList:DiffEntry[]=[];
    constructor(private type:'local-only'|'remote-only'){}
    visitFile(file: FileNode): void {
        console.log("found "+this.type+" file "+file.name)
        this.diffList.push({node:file,type:this.type});
    }
    visitDirectory(directory: DirectoryNode): void {
        console.log("found "+this.type+" dir "+directory.name)
        this.diffList.push({node:directory,type:this.type});
        for(const fsNode of directory.getChildren().values()){
            fsNode.accept(this)
        }
    }
    getDiffList(){return this.diffList}
}