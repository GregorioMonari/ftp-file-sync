import path from "path";
import { QueueEvent } from "./interfaces/queue-event.interface";

export default class PathMapper{
    private localRootPath:string;
    private currentPath:string;

    constructor(pathToWatch:string){
        this.localRootPath= path.resolve(pathToWatch);
        this.currentPath= this.localRootPath;
    }

    public getLocalTargetPath(remoteTargetPath:string){
        let targetPath= this.localRootPath + (remoteTargetPath.startsWith("/|\\")?"":"/") + remoteTargetPath; 
        return targetPath;
    }

    public getRemoteTargetPath(localTargetPath:string){
        let remoteTargetPath=localTargetPath.replace(this.localRootPath,"").replace(/\\/g,"/") //consider we already cd into working dir
        if(remoteTargetPath.startsWith("/")) remoteTargetPath=remoteTargetPath.slice(1);
        return remoteTargetPath;
    }

    public getAbsoluteLocalPath(){
        return this.localRootPath;
    }

    public getFtpRootFolder(localRootFolder:string){
        let ftpRootFolder="";
        if(localRootFolder.includes("/")){
            ftpRootFolder=localRootFolder.slice(
                localRootFolder.lastIndexOf("/")+1, localRootFolder.length)
        }else{
            ftpRootFolder=localRootFolder.slice(
                localRootFolder.lastIndexOf("\\")+1, localRootFolder.length)
        }
        return ftpRootFolder
    } 
}