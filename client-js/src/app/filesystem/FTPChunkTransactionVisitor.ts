import { FileNode, DirectoryNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";
import * as ftp from "basic-ftp";
import * as fs from "fs";
import PathMapper from "../data/mapping/PathMapper";
import TotalSizeFSTVisitor from "./TotalSizeFSTVisitor";
import FileTransferClient from "../FileTransferClient";

export default class FTPChunkTransactionVisitor implements FileSystemVisitor{
    private totalFolderSize=0;
    private transferredBytes=0;
    constructor(
        private type:"UPLOAD"|"DOWNLOAD",
        private fileTranferClient: FileTransferClient, 
    ){}
    async visitFile(file: FileNode): Promise<void> {
        if(this.type=="UPLOAD"){
            await this.fileTranferClient.upload(file.path)
            console.log(`uploading file ${file.path}, transferred ${this.transferredBytes}/${this.totalFolderSize} bytes`)
        }else{
            await this.fileTranferClient.download(file.path)
            console.log(`downloading file ${file.path}, transferred ${this.transferredBytes}/${this.totalFolderSize} bytes`)
        }
        this.transferredBytes=this.transferredBytes+file.data.size;
    }
    //Also uploads root
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        if(directory.name==""){
            //Set folder size only once, before visiting root
            const sizeVisitor= new TotalSizeFSTVisitor();
            await directory.accept(sizeVisitor);
            this.totalFolderSize= sizeVisitor.getTotalSize();
        }
        if(this.type=="UPLOAD"){
            await this.fileTranferClient.mkRemoteDir(directory.path);
            console.log("Created remote folder: "+directory.path)
        }else{
            const {local}=PathMapper.getLocalAndRemoteTargetPath(directory.path);
            fs.mkdirSync(local);
            console.log("Created local folder: "+local)
        }
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
    }
}