import path from "path";

export default class PathMapper{
    private localRootPath:string;
    private ftpRootPath!:string;
    private syncFolderName!:string;

    constructor(pathToWatch:string){
        this.localRootPath= path.resolve(pathToWatch);
        if(this.localRootPath.includes("/")){
            this.syncFolderName=this.localRootPath.slice(
                this.localRootPath.lastIndexOf("/")+1, this.localRootPath.length)
        }else{
            this.syncFolderName=this.localRootPath.slice(
                this.localRootPath.lastIndexOf("\\")+1, this.localRootPath.length)
        }
    }

    //!THESE WORK IF WE ARE IN THE WORKING DIR
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

    public getFtpRootFolder(pwd:string){
        let parsedPwd= "";
        if(pwd.endsWith("/|\\")||pwd.endsWith("\\")){
            parsedPwd=pwd;
        }else{
            parsedPwd=pwd+"/";
        }
        this.ftpRootPath=pwd+(pwd.endsWith("/|\\")?"":"/")+this.syncFolderName;
        return this.ftpRootPath;
    } 

    public getSyncFolderName(){
        return this.syncFolderName;
    }
}