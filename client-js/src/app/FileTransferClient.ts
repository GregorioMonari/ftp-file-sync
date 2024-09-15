import * as ftp from "basic-ftp";
import * as fs from "fs";
import { Config } from "../interfaces/config.interface";
import OpenPortsFinder from "../utils/OpenPortsFinder";
import logger from "../utils/logger";
import PathMapper from "./data/mapping/PathMapper";
import LocalFSTreeGenerator from "./filesystem/LocalFsTreeGenerator";
import * as crypto from 'crypto';
import { Writable } from "stream";
import FTPChunkTransactionVisitor from "./filesystem/FTPChunkTransactionVisitor";
import FTPRemoteFsTreeGenerator from "./filesystem/FTPRemoteFsTreeGenerator";

//NOTA: IL MASTER E' SEMPRE IL FILESYSTEM LOCALE.
//Intendo, è un servizio che uploada un file locale a un server remoto. Il server può cambiare, il locale no.
//Il modo in cui vengono mappate le path da locale a remoto dipende dal pathMapper. Se cambia il client, cambia il mapper
export default class FileTransferClient{
    private host=""; //open ports finder can set this dynamically
    private performReconnection=true;
    private ftpClient:ftp.Client;
    constructor(private config:Config){
        this.ftpClient= new ftp.Client(this.config.timeout)
        this.ftpClient.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            this.performReconnection=false;
            if(this.ftpClient) this.ftpClient.close();
            console.log("onBeforeExit: closed ftp client")
        })
    }

    async connect(){
        //*Set host only the first time the client attempts connection
        if(this.host==""){
            this.host=this.config.host
            if(this.config.autoConnect){
                const discoveryStartTime= performance.now();
                logger.info("Autoconnect enabled, starting ftp servers discovery")
                const finder= new OpenPortsFinder(100); //timeout 100s
                const serverIps= await finder.findLocalServers(this.config.port,true) //stop at first
                if(serverIps.length==0) throw new Error("autoconnect failed, please specify host manually with -host parameter")
                this.host= serverIps[0];
                logger.info("Found FTP server at address: "+this.host+":"+this.config.port+" - "+(performance.now()-discoveryStartTime).toFixed(3)+"ms");
            }
        }

        //*Then, proceed with connection
        const ftpConnStartTime=performance.now()
        logger.info("Connecting to FTP server...")
        await this.ftpClient.access({
            host: this.host,
            port: this.config.port||21,
            user: this.config.user,
            password: this.config.password,
            secure: this.config.secure||false // Set to true if you are using FTPS
        })
        logger.info("Connected to Ftp, logged in - "+(performance.now()-ftpConnStartTime)+"ms")
        
        //*Set reconnection handler
        const father=this;
        this.ftpClient.ftp.socket.on("end",()=>{father.attemptReconnection()})
        this.ftpClient.ftp.socket.on("timeout",()=>{father.attemptReconnection()})

        //*Set remote path
        //const pwd= await this.ftpClient.pwd(); //?why did i use pwd again?
        //this.pathMapper.setFtpRootFolder(pwd);
        //this.ftpRootFolder= this.pathMapper.getFtpRootFolder();
    }
    close(){
        this.performReconnection=false;
        this.ftpClient.close();
    }
    async sendMessage(message:string){
        return await this.ftpClient.send(message);
    }
    async list(path?:string){ //list from remote server
        let parsedPath=path;
        if(path){
            if(PathMapper.isPathLocalAbsoluteFormat(path)){
                parsedPath=PathMapper.getRemoteTargetPath(path);
            }
        }
        return await this.ftpClient.list(parsedPath);
    }
    async upload(path:string){
        const {local,remote}= PathMapper.getLocalAndRemoteTargetPath(path);
        await this.ftpClient.uploadFrom(local,remote);
    }
    async download(path:string){
        const {local,remote}= PathMapper.getLocalAndRemoteTargetPath(path);
        await this.ftpClient.downloadTo(local,remote);
    }
    async uploadDir(path:string){
        await this.uploadDirInChunks(path);
    }
    async downloadDir(path:string){
        await this.downloadDirInChunks(path);
    }

    async mkRemoteDir(path:string){
        let parsedRemotePath=path;
        if(PathMapper.isPathLocalAbsoluteFormat(path)){
            parsedRemotePath= PathMapper.getRemoteTargetPath(path);
        }
        await this.ftpClient.ensureDir(parsedRemotePath);
        await this.cdIntoWorkDir();
    }
    async renameRemote(path:string,pathNext:string){
        let parsedRemotePath=path;
        if(PathMapper.isPathLocalAbsoluteFormat(path)){
            parsedRemotePath= PathMapper.getRemoteTargetPath(path);
        }
        let parsedRemotePathNext=path;
        if(PathMapper.isPathLocalAbsoluteFormat(path)){
            parsedRemotePathNext= PathMapper.getRemoteTargetPath(path);
        }
        await this.ftpClient.rename(parsedRemotePath,parsedRemotePathNext);
    }
    async removeFromRemote(path:string){
        let parsedRemotePath=path;
        if(PathMapper.isPathLocalAbsoluteFormat(path)){
            parsedRemotePath= PathMapper.getRemoteTargetPath(path);
        }
        await this.ftpClient.remove(parsedRemotePath);
    }
    async removeDirFromRemote(path:string){
        let parsedRemotePath=path;
        if(PathMapper.isPathLocalAbsoluteFormat(path)){
            parsedRemotePath= PathMapper.getRemoteTargetPath(path);
        }
        await this.ftpClient.removeDir(parsedRemotePath);
    }

    async pwd(){
        return await this.ftpClient.pwd();
    }
    public async getRemoteFileChecksum(filePath:string){
        let remoteParsedPath= filePath;
        if(PathMapper.isPathLocalAbsoluteFormat(remoteParsedPath)){
            remoteParsedPath= PathMapper.getRemoteTargetPath(filePath)
        }
        const hash = crypto.createHash('md5');
        const stream = new Writable({
            write(chunk, encoding, callback) {
                hash.update(chunk);
                callback();
            },
        })
        await this.ftpClient.downloadTo(stream,remoteParsedPath);
        return hash.digest('hex');
    }

    public async ensureWorkDir(){
        const remoteExists= await this.isFtpRootFolderPresent();
        const localExists= await this.isLocalRootFolderPresent();
        //If either one is missing, download/upload
        if(!localExists)
            throw new Error("Local path does not exist. Please create the folder you are trying to watch. TBI: enable auto create")
        if(localExists && !remoteExists){
            //Upload
            logger.info("Root ftp folder not present, creating one") 
            await this.ftpClient.ensureDir(PathMapper.getRemoteRootPath()) //also cd's into the specified path
            await this.ftpClient.clearWorkingDir() //ensure directory is empty
        }else{
            await this.cdIntoWorkDir();
        }
    }
    private async isFtpRootFolderPresent(){ //!HERE WE ARE STILL IN THE ROOT PATH,MUST BE CALLED BEFORE ENSUREWORKDIR
        const rootFolders = await this.list();
        //Search if folder is already present
        if(rootFolders && rootFolders.length!=0){
            for(const folder of rootFolders){
                if(folder.name==PathMapper.getSharedFolderName()){
                    return true;
                }
            }
        }
        return false;
    }
    private async isLocalRootFolderPresent(){
        return fs.existsSync(PathMapper.getLocalRootPath());
    }

    private async uploadDirInChunks(targetPath:string){
        let parsedTargetPath=targetPath;
        if(!PathMapper.isPathLocalAbsoluteFormat(targetPath)){
            parsedTargetPath= PathMapper.getLocalTargetPath(targetPath)
        }
        logger.debug("Chunk uploading dir "+parsedTargetPath);
        //Create folder tree
        const generator= new LocalFSTreeGenerator();
        const node= await generator.generateFSTreeFromPath(parsedTargetPath);
        //Upload file by file
        const visitor= new FTPChunkTransactionVisitor("UPLOAD",this);
        await node.accept(visitor);
        logger.debug("Chunk upload finished!");
    }
    private async downloadDirInChunks(remoteTargetPath:string){
        logger.debug("Chunk downloading dir "+remoteTargetPath);
        //Create folder tree
        const generator= new FTPRemoteFsTreeGenerator(this);
        const node= await generator.generateFSTreeFromPath(remoteTargetPath);
        //Upload file by file
        const visitor= new FTPChunkTransactionVisitor("DOWNLOAD",this);
        await node.accept(visitor);
        logger.debug("Chunk download finished!");
    }


    //---UTILS---
    private async attemptReconnection(){
        if(this.performReconnection){
            logger.info("lost connection to ftp server, trying to reconnect")
            let reconnected=false;
            let attemptN=1;
            while(!reconnected){
                logger.info("reconnect attempt "+attemptN+"...")
                try{
                    await this.connect();
                    reconnected=true;
                }catch(e){
                    await this.wait(5000)
                }
                attemptN++;
            }
        }
    }
    //Private, because from the outside no one must perform cd operations
    private async cdIntoWorkDir(){
        await this.ftpClient.cd(PathMapper.getRemoteRootPath())
    }
    //Others
    private async wait(ms:number){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
    }
    private async ping(){
        await this.pwd();
    }
}