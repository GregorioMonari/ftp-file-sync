import path from "path";

/**
 * Manage the sharedFolder path, enabling conversion between local and remote format paths
 * IMPORTANT: local paths are ABSOLUTE, while remote paths, in ftp, are RELATIVE to the current working directory
 */
export default class PathMapper{
    private static localRootPath:string; //Ex. C://Users/Greg/shared_test_folder
    private static remoteRootPath:string;   //Ex. /ftp/users/myuser/shared_test_folder
    private static sharedFolderName:string; //Just the dirName without paths or '/', ex. "shared_test_folder"
    private static initialized=false;

    //Variables useful to convert paths between local and remote
    private static localPathSeparator=""
    private static ftpPathSeparator=""

    //use pwd of remote path instead of path with folder name
    public static setLocalAndRemotePaths(localRootPath:string,ftpRootDirPwd:string){
        if(this.initialized) throw new Error("Path mapper cannot be initialized twice")
        //*Get absolute local path
        this.localRootPath= path.resolve(localRootPath);
        this.localPathSeparator= this.localRootPath.includes("\\")?"\\":"/";
        //*Get shared folder name
        this.sharedFolderName=this.localRootPath.slice(
            this.localRootPath.lastIndexOf(this.localPathSeparator)+1, this.localRootPath.length)
        //*Construct ftp absolute path
        this.ftpPathSeparator= ftpRootDirPwd.includes("\\")?"\\":"/";
        let parsedPwd= ftpRootDirPwd;
        if(!parsedPwd.endsWith(this.ftpPathSeparator)) parsedPwd=parsedPwd+this.ftpPathSeparator;
        this.remoteRootPath=parsedPwd+this.sharedFolderName;
        this.initialized=true;
    }
    public static getLocalRootPath(){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        return this.localRootPath
    }
    public static getRemoteRootPath(){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        return this.remoteRootPath
    }
    public static getSharedFolderName(){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        return this.sharedFolderName
    }
    public static getLocalAndRemoteTargetPath(path:string):{local:string;remote:string;}{
        if(this.isPathLocalAbsoluteFormat(path)){
            return {
                local: this.ensureCorrectSeparator(path,this.localPathSeparator),
                remote: this.getRemoteTargetPath(path) //also replaces \ with /
            }
        }else{
            return {
                local: this.getLocalTargetPath(path),
                remote: this.ensureCorrectSeparator(path,this.ftpPathSeparator) //ensure ftp path is always correct
            }
        }
    }

    private static ensureCorrectSeparator(path:string,sep:string):string{
        let parsedPath=path;
        if(sep=="/"){
            if(path.includes("\\")) parsedPath=parsedPath.replace(/\\/g,"/")
        }else if(sep=="\\"){
            if(path.includes("/")) parsedPath=parsedPath.replace(/\//g,"\\")
        }
    return parsedPath;
    }

    private static isPathLocalAbsoluteFormat(testPath:string){
        if(testPath.includes(this.localRootPath)) return true;
        return false;
    }



    //!THESE WORK IF WE ARE IN THE WORKING DIR
    //ALSO, THEY CANNOT BE CALLED ALONE. Remote target path may contain \\, which are not allowed in ftp. So always call getLocalAndRemoteTargetPath
    private static getLocalTargetPath(remoteTargetPath:string){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        if(this.isPathLocalAbsoluteFormat(remoteTargetPath)) throw new Error("provided local path instead of remote: "+remoteTargetPath)
        let targetPath= this.localRootPath + (remoteTargetPath.startsWith("/|\\")?"":"/") + remoteTargetPath; 
        return this.ensureCorrectSeparator(targetPath,this.localPathSeparator);
    }
    //Ex. C://Users/Greg/shared_test_folder/mao/bubus.txt -> mao/bubus.txt
    private static getRemoteTargetPath(localTargetPath:string){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        if(!this.isPathLocalAbsoluteFormat(localTargetPath)) throw new Error("provided remote path instead of local: "+localTargetPath)
        console.log("get remote target path from:",localTargetPath)
        let remoteTargetPath=localTargetPath.replace(this.localRootPath,"") //consider we already cd into working dir
        if(remoteTargetPath.startsWith("/|\\")) remoteTargetPath=remoteTargetPath.slice(1);
        //console.log(remoteTargetPath)
        return this.ensureCorrectSeparator(remoteTargetPath,this.ftpPathSeparator);
    }
}