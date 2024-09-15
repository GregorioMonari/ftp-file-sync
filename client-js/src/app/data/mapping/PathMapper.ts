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

    //use pwd of remote path instead of path with folder name
    public static setLocalAndRemotePaths(localRootPath:string,ftpRootDirPwd:string){
        if(this.initialized) throw new Error("Path mapper cannot be initialized twice")
        //*Get absolute local path
        this.localRootPath= path.resolve(localRootPath);
        //*Get shared folder name
        if(this.localRootPath.includes("/")){
            this.sharedFolderName=this.localRootPath.slice(
                this.localRootPath.lastIndexOf("/")+1, this.localRootPath.length)
        }else{
            this.sharedFolderName=this.localRootPath.slice(
                this.localRootPath.lastIndexOf("\\")+1, this.localRootPath.length)
        }
        //*Construct ftp absolute path
        let parsedPwd= "";
        if(ftpRootDirPwd.endsWith("/|\\")||ftpRootDirPwd.endsWith("\\")){
            parsedPwd=ftpRootDirPwd;
        }else{
            parsedPwd=ftpRootDirPwd+"/";
        }
        this.remoteRootPath=ftpRootDirPwd+(ftpRootDirPwd.endsWith("/|\\")?"":"/")+this.sharedFolderName;
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
                local: path,
                remote: this.getRemoteTargetPath(path)
            }
        }else{
            return {
                local: this.getLocalTargetPath(path),
                remote: path
            }
        }
    }

    static isPathLocalAbsoluteFormat(testPath:string){
        if(testPath.includes(this.localRootPath)) return true;
        return false;
    }



    //!THESE WORK IF WE ARE IN THE WORKING DIR
    static getLocalTargetPath(remoteTargetPath:string){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        if(this.isPathLocalAbsoluteFormat(remoteTargetPath)) throw new Error("provided local path instead of remote: "+remoteTargetPath)
        
        let targetPath= this.localRootPath + (remoteTargetPath.startsWith("/|\\")?"":"/") + remoteTargetPath; 
        return targetPath;
    }
    //Ex. C://Users/Greg/shared_test_folder/mao -> /ftp/users/myuser/shared_test_folder/mao
    static getRemoteTargetPath(localTargetPath:string){
        if(!this.initialized) throw new Error("PathMapper is not initialized. Please initialize this static class with setLocalAndRemotePaths(lp,pwd)")
        if(!this.isPathLocalAbsoluteFormat(localTargetPath)) throw new Error("provided remote path instead of local: "+localTargetPath)
        
        let remoteTargetPath=localTargetPath.replace(this.localRootPath,"").replace(/\\/g,"/") //consider we already cd into working dir
        if(remoteTargetPath.startsWith("/")) remoteTargetPath=remoteTargetPath.slice(1);
        return remoteTargetPath;
    }
}