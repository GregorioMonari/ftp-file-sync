import { DiffEntry } from "../../interfaces/diff-entry.interface";
import { FSEntry } from "../../lib/filesystem-tree-visitor/fs-entry.interface";
import { DirectoryNode, FileNode, FileSystemNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";
import { getLocalFileChecksum } from "../checksum-utils";
import FileTransferClient from "../FileTransferClient";


export default class ComparisonFSTreeVisitor implements FileSystemVisitor{
    private currCompareDir:DirectoryNode;
    private diffList:DiffEntry[]=[];
    constructor(private treeToCompare:DirectoryNode,private fileTransferClient:FileTransferClient,private recursive?:boolean){
        this.currCompareDir=treeToCompare;
    }
    getDiffList(){
        return this.diffList;
    }
    async visitFile(file: FileNode): Promise<void> {
        //If we are here, both files exists. Now check for modifications or conflicts!
        const fileToCompare= this.currCompareDir.getChildren().get(file.name) as FileNode;
        console.log("checking file1: "+file.name+", file2: "+fileToCompare.name)

        //local time <=  remote time di base. Se è > allora abbiamo modifiche in locale SICURO
        if(file.data.mtime>fileToCompare.data.mtime){
            console.log("found changed file: "+file.name+", times:",file.data.mtime,fileToCompare.data.mtime)
            this.diffList.push({localNode:file,remoteNode:fileToCompare,type:"changed"});
        }else{
            //Compara bitesize and checksum
            if(file.data.size!=fileToCompare.data.size){
                console.log("found changed file: "+file.name+", sizes:",file.data.size,fileToCompare.data.size)
                //throw new Error("Conflict found between local and remote file, TBI: "+fileToCompare.name)
                this.diffList.push({localNode:file,remoteNode:fileToCompare,type:"changed"});
            }else{
                //TODO: COMPARE CHECKSUM
                let fileChecksum="";
                let fileToCompareChecksum="";
                //GET LOCAL CHECKSUM
                if(file.data.checksum){
                    fileChecksum= file.data.checksum;
                }else{
                    fileChecksum= await getLocalFileChecksum(file.path);
                }
                //!GET REMOTE CHECKSUM: sync should have that already saved, while ftp needs fetching
                if(fileToCompare.data.checksum){
                    fileToCompareChecksum= fileToCompare.data.checksum;
                }else{
                    console.log("Get remote file checksumn")
                    fileToCompareChecksum= await this.fileTransferClient.getRemoteFileChecksum(fileToCompare.path);
                    console.log("Gotcha")
                }
                if(fileChecksum!=fileToCompareChecksum){
                    console.log("found changed file: "+file.name+", checksums:",file.data.checksum,fileToCompare.data.checksum)
                    this.diffList.push({localNode:file,remoteNode:fileToCompare,type:"changed"})
                }
            }
        }
    }
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        console.log("checking dir1: "+(directory.name?directory.name:"root")+", dir2: "+(this.currCompareDir.name?this.currCompareDir.name:"root"))
        //If we are here, both trees have this directory. Compare contents
        for(const fsNode of directory.getChildren().values()){
            if(this.currCompareDir.getChildren().has(fsNode.name)){
                if(fsNode.data.isDirectory){
                    const oldDir= this.currCompareDir;
                    this.currCompareDir=this.currCompareDir.getChildren().get(fsNode.name) as DirectoryNode;
                    await fsNode.accept(this); //explore subdir
                    this.currCompareDir=oldDir;
                }else{
                    await fsNode.accept(this) //compare files
                }
            }else{
                if(fsNode.data.isDirectory){
                    if(this.recursive){
                        //*EXPLORE LOCAL ONLY DIRECTORY
                        const stDiffVisitor= new SingleTreeDiffVisitor('local-only');
                        await fsNode.accept(stDiffVisitor)
                        this.diffList= this.diffList.concat(stDiffVisitor.getDiffList())
                    }else{
                        //*Just add dir
                        console.log("found local-only dir "+fsNode.name)
                        this.diffList.push({localNode:fsNode,type:'local-only'});
                    }
                }else{
                    //*Add local-only file to diff, no exploration needed
                    console.log("found local-only file "+fsNode.name)
                    this.diffList.push({localNode:fsNode,type:'local-only'});
                }
            }
        }
        //Now, check for remote-only
        for(const remoteFsNode of this.currCompareDir.getChildren().values()){
            if(!directory.getChildren().has(remoteFsNode.name)){
                if(remoteFsNode.data.isDirectory){
                    if(this.recursive){
                        //*EXPLORE REMOTE ONLY DIRECTORY
                        const stDiffVisitor= new SingleTreeDiffVisitor('remote-only');
                        await remoteFsNode.accept(stDiffVisitor)
                        this.diffList= this.diffList.concat(stDiffVisitor.getDiffList())
                    }else{
                        //*Just add dir
                        console.log("found remote-only dir "+remoteFsNode.name)
                        this.diffList.push({remoteNode:remoteFsNode,type:'remote-only'});
                    }
                }else{
                    //*Add remote-only file to diff, no exploration needed
                    console.log("found remote-only file "+remoteFsNode.name)
                    this.diffList.push({remoteNode:remoteFsNode,type:'remote-only'});
                }
            }
        }
    }
}


class SingleTreeDiffVisitor implements FileSystemVisitor{
    private diffList:DiffEntry[]=[];
    constructor(private type:'local-only'|'remote-only'){}
    async visitFile(file: FileNode): Promise<void> {
        console.log("found "+this.type+" file "+file.name)
        this.diffList.push({[this.type=='local-only'?"localNode":"remoteNode"]:file,type:this.type});
    }
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        console.log("found "+this.type+" dir "+directory.name)
        this.diffList.push({[this.type=='local-only'?"localNode":"remoteNode"]:directory,type:this.type});
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
    }
    getDiffList(){return this.diffList}
}