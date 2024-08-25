import * as fs from "fs";
import * as ftp from "basic-ftp";
import WebSocket, {MessageEvent} from "ws";
import { importEsmModule } from "../utils/esm-compatibility";
import type Watcher from "watcher";
import { Config } from "../interfaces/config.interface";
import WsConnector from "./WsConnector";
import PathMapper from "./PathMapper";
import { QueueEvent } from "../interfaces/queue-event.interface";
import QueueScheduler from "./queue/QueueScheduler";
import CommandsMap from "./CommandsMap";
import LocalFSTreeGenerator from "./filesystem-tree/LocalFsTreeGenerator";
import PrintFSTreeVisitor from "./filesystem-tree/PrintFSTreeVisitor";
import FTPRemoteFsTreeGenerator from "./filesystem-tree/FTPRemoteFsTreeGenerator";
import TotalSizeFSTVisitor from "./filesystem-tree/TotalSizeFSTVisitor";
import ComparisonFSTreeVisitor from "./filesystem-tree/ComparisonFSTreeVisitor";
import logger from "../utils/logger";
import { DiffEntry } from "../interfaces/diff-entry.interface";

export default class ClientSynchronizer{
    private config:Config;
    private localRootFolder:string;
    private ftpRootFolder:string;

    private client:ftp.Client; //handle file upload/download
    private webSocket!:WebSocket; //captures incoming events
    private watcher!:Watcher; //produces outgoing events

    private pathMapper:PathMapper;
    private queueScheduler:QueueScheduler;

    constructor(config:Config){
        this.config=config;
        this.pathMapper= new PathMapper(this.config.pathToWatch);

        this.localRootFolder= this.pathMapper.getAbsoluteLocalPath();
        this.ftpRootFolder= this.pathMapper.getFtpRootFolder(this.localRootFolder)

        this.client = new ftp.Client(this.config.timeout)
        this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            if(this.client) this.client.close();
            if(this.watcher) this.watcher.close()
            console.log("onBeforeExit: closed client and watcher")
        })
        this.queueScheduler= new QueueScheduler(this);
    }

    
    async start(){
        //Print parameters
        console.log("File Watcher path:",this.localRootFolder)
        console.log("FTP Root path:",this.ftpRootFolder)
        console.log("FTP connection parameters:")
        console.log("- host:",this.config.host)
        console.log("- port:",this.config.port)
        console.log("- user:",this.config.user)

        //Connect to Ftp
        const ftpConnStartTime=performance.now()
        logger.info("Connecting to FTP server...")
        await this.client.access({
            host: this.config.host,
            port: this.config.port||21,
            user: this.config.user,
            password: this.config.password,
            secure: this.config.secure||false // Set to true if you are using FTPS
        })
        logger.info("Connected to Ftp, logged in - "+(performance.now()-ftpConnStartTime)+"ms")

        //Synchronize client with server at startup
        await this.synchronize();

        //Start watcher
        const father=this;
        const WatcherModule:any = await importEsmModule<typeof Watcher>("watcher");
        this.watcher = new WatcherModule.default (this.config.pathToWatch,{
            ignoreInitial:true,
            depth:20,
            recursive: true
        });
        this.watcher.on ( 'all',(event,targetPath,targetPathNext)=>{
            father.onWatcherMessage(event,targetPath,targetPathNext)
        });

        if(this.config.subscribe){
            await this.subscribe();
        }
    }

    async subscribe(){
        logger.warn("Websocket subscription still in development, use at your own risk");
        const father=this;
        //Subscribe to WebSocket and handle incoming events
        const wsConnector= new WsConnector(this.config,this.client);
        this.webSocket= await wsConnector.subscribe();
        this.webSocket.on("message",(data)=>{
            father.onWsMessage(data)
        })
    }

    //HERE WE ARE STILL IN THE ROOT PATH
    async isFtpRootFolderPresent(){
        const rootFolders = await this.client.list() 
        //Search if folder is already present
        if(rootFolders && rootFolders.length!=0){
            for(const folder of rootFolders){
                if(folder.name==this.ftpRootFolder){
                    return true;
                }
            }
        }
        return false;
    }

    async isLocalRootFolderPresent(){
        return fs.existsSync(this.localRootFolder);
    }

    async synchronize(){
        const syncStartTime=performance.now();
        logger.info("Synchronizing with server...")
        //Ensure both local and remote directory are present
        const remoteExists= await this.isFtpRootFolderPresent();
        const localExists= await this.isLocalRootFolderPresent();
        //If either one is missing, download/upload
        if(!localExists)
            throw new Error("Local path does not exist. Please create the folder you are trying to watch. TBI: enable auto create")
        if(localExists && !remoteExists){
            //Upload
            logger.info("Root ftp folder not present, creating one") 
            await this.client.ensureDir(this.ftpRootFolder) //also cd's into the specified path
            await this.client.clearWorkingDir() //ensure directory is empty
            await this.client.uploadFromDir(this.localRootFolder) //upload to working directory if rootPath is undefined 
            return;
        }
        //If we are here, both directories exist. Cd into workding dir and sync with timestamps
        await this.client.cd(this.ftpRootFolder)

        //*If both are present, check last modification to synchronize
        logger.info("generating file-system trees")
        const treeGenStartTime= performance.now();
        const localGenerator= new LocalFSTreeGenerator();
        const remoteGenerator= new FTPRemoteFsTreeGenerator(this.client);
        const printer= new PrintFSTreeVisitor();
        const totalSizeVisitor= new TotalSizeFSTVisitor();

        //GENERATE FSTREES
        const localTreeRoot= await localGenerator.generateFSTreeFromPath(this.localRootFolder);
        const remoteTreeRoot= await remoteGenerator.generateFSTreeFromPath("./");//WE ALREADY CD INTO WORKING DIR //this.ftpRootFolder);

        //PRINT TREES        
        console.log("## Local:")
        localTreeRoot.accept(printer);
        localTreeRoot.accept(totalSizeVisitor);
        console.log("size: "+totalSizeVisitor.getTotalSize()+" bytes")
        console.log("## Remote:")
        remoteTreeRoot.accept(printer);
        totalSizeVisitor.resetSize()
        remoteTreeRoot.accept(totalSizeVisitor);
        console.log("size: "+totalSizeVisitor.getTotalSize()+" bytes")
        logger.info("generated fs trees - "+(performance.now()-treeGenStartTime)+"ms")

        //CHECK DIFF
        logger.info("checking for differences between trees")
        const diffCheckerVisitor= new ComparisonFSTreeVisitor(remoteTreeRoot);
        localTreeRoot.accept(diffCheckerVisitor);
        const diffList= diffCheckerVisitor.getDiffList();
        logger.info("found "+diffList.length+" differences")
        if(diffList.length>0){
            await this.mergeDiffs(diffList)
        }
        logger.info("Synchronization completed! - "+(performance.now()-syncStartTime)+"ms")
    }

    async mergeDiffs(diffList:DiffEntry[]){
        logger.info("merging changes...")
        let localPath,remotePath:string;
        for(const diffEntry of diffList){
            switch (diffEntry.type) {
                case "local-only":
                    localPath= diffEntry.node.path;
                    remotePath= this.pathMapper.getRemoteTargetPath(localPath);
                    if(diffEntry.node.data.isDirectory){
                        logger.debug("uploading dir "+localPath+" to: "+remotePath)
                        await this.client.uploadFromDir(localPath, remotePath);
                    }else{
                        logger.debug("uploading file "+localPath+" to: "+remotePath)
                        await this.client.uploadFrom(localPath, remotePath);
                    }
                    break;
                case "remote-only":
                    remotePath= diffEntry.node.path;
                    localPath= this.pathMapper.getLocalTargetPath(remotePath);
                    if(diffEntry.node.data.isDirectory){
                        logger.debug("downloading dir "+remotePath+" to: "+localPath)
                        await this.client.downloadToDir(localPath, remotePath);
                    }else{
                        logger.debug("downloading file "+remotePath+" to: "+localPath)
                        await this.client.downloadTo(localPath, remotePath);
                    }
                    break;
                case "local-changed":
                    localPath= diffEntry.node.path;
                    remotePath= this.pathMapper.getRemoteTargetPath(localPath);
                    logger.debug("uploading file "+localPath+" to: "+remotePath);
                    await this.client.uploadFrom(localPath, remotePath);
                    break;
                case "remote-changed":
                    remotePath= diffEntry.node.path;
                    localPath= this.pathMapper.getLocalTargetPath(remotePath);
                    logger.debug("downloading file "+remotePath+" to: "+localPath)
                    await this.client.downloadTo(localPath, remotePath);
                    break;
                default:
                    break;
            }
        }
    }




    //Add Inbound and Outbound events to queue
    async onWatcherMessage(event:string, targetPath:string, targetPathNext?:string ){
        this.queueScheduler.add({
            type: "watcher",
            data: {event,targetPath,targetPathNext:targetPathNext||null}
        })
    }

    async onWsMessage(event: any){
        const command= event.toString();
        //if(command.split(" ")[0]=="RNFR"){
        this.queueScheduler.previousServerCommandsBuffer.push(command) //add command to hys
        //return;
        //}
        this.queueScheduler.add({
            type: "websocket",
            data: {command}
        })
    }

    //Manage queue notifications
    async onWatcherQueueNotification(event: QueueEvent){
        const watcherEvent= event.data.event as string;
        const targetPath= event.data.targetPath as string;
        const remoteTargetPath= this.pathMapper.getRemoteTargetPath(targetPath);

        //Check if there are server commands in the buffer
        const previousServerCommands:string[]= this.queueScheduler.previousServerCommandsBuffer;
        let cmdName="";
        let cmdPath="";
        if(previousServerCommands.length!=0){
            const lastCommand= previousServerCommands[0];
            cmdName= lastCommand.split(" ")[0];
            cmdPath= lastCommand.split(" ")[1];
        }

        //Avoid sending back ws commands
        if(cmdName!=""&&cmdName==CommandsMap.event2commandName[watcherEvent]){
            //Compare paths
            if(cmdPath==remoteTargetPath){
                console.log("Skipped change notification because it matches the last server command: "+cmdName)
                previousServerCommands.shift(); //delete last server notification
                return;
            }
        }

        switch (watcherEvent) {
            case "change":
                await this.client.uploadFrom(targetPath, remoteTargetPath);
                console.log("uploaded changed file to remote path:",remoteTargetPath)
                break;
            case "add":
                await this.client.uploadFrom(targetPath, remoteTargetPath);
                console.log("added file to remote path:",remoteTargetPath)
                break;
            case "addDir":
                await this.client.uploadFromDir(targetPath, remoteTargetPath);
                console.log("added directory to remote path:",remoteTargetPath)
                break;
            case "rename":
                const targetPathNext= event.data.targetPathNext as string;
                const remoteTargetPathNext= this.pathMapper.getRemoteTargetPath(targetPathNext);
                await this.client.rename(remoteTargetPath, remoteTargetPathNext);
                break;
            case "renameDir":
                const targetDirNext= event.data.targetDirNext as string;
                const remoteTargetDirNext= this.pathMapper.getRemoteTargetPath(targetDirNext);
                await this.client.rename(remoteTargetPath, remoteTargetDirNext);
                break;
            case "unlink":
                await this.client.remove(remoteTargetPath);
                console.log("removing file from remote path:",remoteTargetPath)
                break;
            case "unlinkDir": //!THIS HAS STRANGE PATH
                await this.client.removeDir(remoteTargetPath);
                console.log("removing directory from remote path:",remoteTargetPath)
                break;
            default:
                console.log("skipping unknown event:",event)
                break;
        }
    }

    async onWsQueueNotification(event: QueueEvent){
        const command= event.data.command as string;
        console.log("Received command notification from server:",command)
        const commandName= command.split(" ")[0];
        const remoteTargetPath= command.split(" ")[1];
        const targetPath= this.pathMapper.getLocalTargetPath(remoteTargetPath);
        
        switch(commandName){
            case "STOR":
                await this.client.downloadTo(targetPath, remoteTargetPath);
                console.log("downloaded changed file from remote path:",remoteTargetPath)
                break;
            case "MKD":
                fs.mkdirSync(targetPath);
                console.log("created directory from remote path:",remoteTargetPath)
                break;
            case "RNFR":
                //do nothing, wait for next notification 
                break;
            case "RNTO":
                if(this.queueScheduler.previousServerCommandsBuffer.length==0){
                    throw new Error("RNTO must be preceeded by a RNFR command")
                }
                const previousCommand:string= this.queueScheduler.previousServerCommandsBuffer[0];
                //this.queueScheduler.previousServerCommandsBuffer.shift(); //shifted both by watcher handler

                const remoteTargetPathNext= previousCommand.split(" ")[1];
                const targetPathNext= this.pathMapper.getLocalTargetPath(remoteTargetPathNext);
                fs.renameSync(targetPath,targetPathNext)
                //await this.client.downloadTo(targetPath, remoteTargetPath);
                //console.log("uploaded changed file to remote path:",remoteTargetPath)
                break;
            case "DELE":
                fs.unlinkSync(targetPath);
                console.log("deleted directory from remote path:",remoteTargetPath)
                break;
            case "RMD":
                fs.rmSync(targetPath,{recursive: true, force: true});
                console.log("deleted directory from remote path:",remoteTargetPath)
                break;
            default:
                console.log("skipping unknown event:",command)
                break;
        }
        
    }
}