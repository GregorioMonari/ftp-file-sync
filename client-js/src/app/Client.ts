import * as fs from "fs";
import * as ftp from "basic-ftp";
import WebSocket, {MessageEvent} from "ws";
import { importEsmModule } from "../utils/esm-compatibility";
import type Watcher from "watcher";
import { Config } from "../interfaces/config.interface";
import WsConnector from "./events/WsConnector";
import PathMapper from "./mapping/PathMapper";
import { QueueEvent } from "../interfaces/queue-event.interface";
import QueueScheduler from "./queue/QueueScheduler";
import CommandsMap from "./mapping/CommandsMap";
import LocalFSTreeGenerator from "./fst-visitors/LocalFsTreeGenerator";
import PrintFSTreeVisitor from "./fst-visitors/PrintFSTreeVisitor";
import FTPRemoteFsTreeGenerator from "./fst-visitors/FTPRemoteFsTreeGenerator";
import TotalSizeFSTVisitor from "./fst-visitors/TotalSizeFSTVisitor";
import ComparisonFSTreeVisitor from "./fst-visitors/ComparisonFSTreeVisitor";
import logger from "../utils/logger";
import { DiffEntry } from "../interfaces/diff-entry.interface";
import OpenPortsFinder from "./discovery/OpenPortsFinder";

export default class Client{
    private config:Config;
    private host:string;
    private localRootFolder:string;
    private ftpRootFolder:string;

    private client:ftp.Client; //handle file upload/download
    private webSocket!:WebSocket; //captures incoming events
    private watcher!:Watcher; //produces outgoing events

    private pathMapper:PathMapper;
    private queueScheduler:QueueScheduler;

    private pingServer:boolean=true; //if set to false the ping loop will stop
    private pingPeriod:number=0;
    private performReconnection:boolean=true;

    constructor(config:Config){
        this.config=config;
        this.host= config.host;
        this.pathMapper= new PathMapper(this.config.pathToWatch);

        this.localRootFolder= this.pathMapper.getAbsoluteLocalPath();
        this.ftpRootFolder= this.pathMapper.getFtpRootFolder(this.localRootFolder)

        this.client = new ftp.Client(this.config.timeout)
        this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            //avoid reconnection
            this.performReconnection=false;
            if(this.client) this.client.close();
            if(this.watcher) this.watcher.close();
            console.log("onBeforeExit: closed client and watcher")
        })
        this.queueScheduler= new QueueScheduler(this);
    }

    
    async start(){
        //Print parameters
        console.log("File Watcher path:",this.localRootFolder)
        console.log("FTP Root path:",this.ftpRootFolder)
        console.log("FTP connection parameters:")
        console.log("- host:",(this.config.autoConnect?"autoconnect":this.config.host))
        console.log("- port:",this.config.port)
        console.log("- user:",this.config.user)

        //let host="";
        //*If autoconnect is enabled, start ftp servers discovery
        if(this.config.autoConnect){
            const discoveryStartTime= performance.now();
            logger.info("Autoconnect enabled, starting ftp servers discovery")
            const finder= new OpenPortsFinder(100); //timeout 100s
            const serverIps= await finder.findLocalServers(this.config.port,true) //stop at first
            if(serverIps.length==0) throw new Error("autoconnect failed, please specify host manually with -host parameter")
            this.host= serverIps[0];
            logger.info("Found FTP server at address: "+this.host+":"+this.config.port+" - "+(performance.now()-discoveryStartTime).toFixed(3)+"ms");
        }else{
            this.host=this.config.host;
        }

        //Connect and perform synchronization
        await this.connectAndSync()

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

    async stop(){
        this.pingServer=false;
        this.performReconnection=false;
        if(this.client) this.client.close();
        if(this.watcher) this.watcher.close();
        //todo: stop ws connection
    }




    //Connections
    async connectAndSync(){
        //Connect to Ftp
        const ftpConnStartTime=performance.now()
        logger.info("Connecting to FTP server...")
        await this.client.access({
            host: this.host,
            port: this.config.port||21,
            user: this.config.user,
            password: this.config.password,
            secure: this.config.secure||false // Set to true if you are using FTPS
        })
        logger.info("Connected to Ftp, logged in - "+(performance.now()-ftpConnStartTime)+"ms")

        //Set reconnection
        const father=this;
        this.client.ftp.socket.on("end",()=>{father.reconnect()})
        this.client.ftp.socket.on("timeout",()=>{father.reconnect()})

        //Synchronize client with server at startup
        await this.synchronize();

        //Ping the server continuously to keep the connection open indefinitely.
        //?May move to proxy or remove ftp and use https from client to proxy
        this.pingPeriod= 15 * 1000
        await this.startPingServerLoop() //ping every 15s
    }
    async reconnect(){
        if(this.performReconnection){
            logger.info("lost connection to ftp server, trying to reconnect")
            let reconnected=false;
            let attemptN=1;
            while(!reconnected){
                logger.info("reconnect attempt "+attemptN+"...")
                try{
                    await this.connectAndSync();
                    reconnected=true;
                }catch(e){
                    await this.wait(5000)
                }
                attemptN++;
            }
        }
    }

    async ping(){
        await this.client.pwd();
    }
    async startPingServerLoop(/*ms:number*/){
        if(this.pingServer){
            logger.silly("pinging ftp server...")
            this.queueScheduler.add({ //Add to queue instead of pinging directly to avoid collisions
                type: "watcher",
                data: {event:"ping",targetPath:"",targetPathNext:""}
            })
            //await this.ping();
            //await this.wait(ms);
        }
    }
    async wait(ms:number){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
    }




    //SYNCHRONIZATION
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
            //!IF I JUST CREATE THE DIRECTORY, SYNC SHOULD TAKE CARE OF THE REST
            //await this.client.uploadFromDir(this.localRootFolder) //upload to working directory if rootPath is undefined 
            //return;
        }else{
            await this.cdIntoWorkDir();
        }
        
        //*If we are here both directories are present, check last modifications to synchronize
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
    async isFtpRootFolderPresent(){ //!HERE WE ARE STILL IN THE ROOT PATH
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
    async cdIntoWorkDir(){
        await this.client.cd("/"+this.ftpRootFolder)
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
                        logger.debug("adding dir "+localPath+" to: "+remotePath)
                        await this.client.ensureDir(remotePath); //!ADD DIR ONLY
                        //logger.debug("cd into working dir: "+this.ftpRootFolder)
                        await this.cdIntoWorkDir();
                    }else{
                        logger.debug("uploading file "+localPath+" to: "+remotePath)
                        await this.client.uploadFrom(localPath, remotePath);
                    }
                    break;
                case "remote-only":
                    remotePath= diffEntry.node.path;
                    localPath= this.pathMapper.getLocalTargetPath(remotePath);
                    if(diffEntry.node.data.isDirectory){
                        logger.debug("adding dir "+remotePath+" to: "+localPath)
                        //await this.client.downloadToDir(localPath, remotePath); //!ADD DIR ONLY
                        fs.mkdirSync(localPath);
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



    //EVENTS
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
    async onWatcherQueueNotification(event: QueueEvent):Promise<void>{
        const watcherEvent= event.data.event as string;

        //PING THE SERVER CONTINUOUSLY TO KEEP ALIVE THE CONNECTION
        if(watcherEvent=="ping"){
            await this.client.pwd();
            this.wait(this.pingPeriod).then(()=>{
                this.startPingServerLoop();
            })
            return;
        }

        //Get paths
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
                logger.info("uploaded changed file "+targetPath+" to: "+remoteTargetPath)
                break;
            case "add":
                await this.client.uploadFrom(targetPath, remoteTargetPath);
                logger.info("added file "+targetPath+" to: "+remoteTargetPath)
                break;
            case "addDir":
                await this.client.uploadFromDir(targetPath, remoteTargetPath); //TODO: USE TREE INSTEAD OF UPLOADING WHOLE DIR AT ONCE
                logger.info("added directory "+targetPath+" to: "+remoteTargetPath)
                break;
            case "rename":
                const targetPathNext= event.data.targetPathNext as string;
                const remoteTargetPathNext= this.pathMapper.getRemoteTargetPath(targetPathNext);
                await this.client.rename(remoteTargetPath, remoteTargetPathNext);
                logger.info("renamed file "+remoteTargetPath+" to "+remoteTargetPath)
                break;
            case "renameDir":
                const targetDirNext= event.data.targetDirNext as string;
                const remoteTargetDirNext= this.pathMapper.getRemoteTargetPath(targetDirNext);
                await this.client.rename(remoteTargetPath, remoteTargetDirNext);
                logger.info("renamed dir "+remoteTargetPath+" to "+remoteTargetDirNext)
                break;
            case "unlink":
                await this.client.remove(remoteTargetPath);
                logger.info("removing file from remote path:",remoteTargetPath)
                break;
            case "unlinkDir": //!THIS HAS STRANGE PATH
                await this.client.removeDir(remoteTargetPath);
                logger.info("removing directory from remote path:",remoteTargetPath)
                break;
            default:
                logger.warn("skipping unknown event:",event)
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