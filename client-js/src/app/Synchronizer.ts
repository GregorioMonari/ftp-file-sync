import * as fs from "fs";
import WebSocket, {MessageEvent} from "ws";
import { importEsmModule } from "../utils/esm-compatibility";
import type Watcher from "watcher";
import { Config } from "../interfaces/config.interface";
import WsConnector from "./WsConnector";
import PathMapper from "./data/mapping/PathMapper";
import { QueueEvent } from "../interfaces/queue-event.interface";
import QueueScheduler from "./data/queue/QueueScheduler";
import CommandsMap from "./data/mapping/CommandsMap";
import LocalFSTreeGenerator from "./filesystem/LocalFsTreeGenerator";
import PrintFSTreeVisitor from "./filesystem/PrintFSTreeVisitor";
import FTPRemoteFsTreeGenerator from "./filesystem/FTPRemoteFsTreeGenerator";
import TotalSizeFSTVisitor from "./filesystem/TotalSizeFSTVisitor";
import ComparisonFSTreeVisitor from "./filesystem/ComparisonFSTreeVisitor";
import logger from "../utils/logger";
import { DiffEntry } from "../interfaces/diff-entry.interface";
import SyncStateDb from "./filesystem/sync-state-db/SyncStateDb";
import { DirectoryNode, FileSystemNode } from "../lib/filesystem-tree-visitor/FileSystemNode";
import SqliteSyncStateDb from "./filesystem/sync-state-db/SqliteSyncStateDb";
import FileTransferClient from "./FileTransferClient";

export default class Synchronizer{
    private config:Config;
    //private host:string;
    //private localRootFolder:string;
    //private ftpRootFolder!:string;

    private client:FileTransferClient; //handle file upload/download
    private webSocket!:WebSocket; //captures incoming events
    private watcher!:Watcher; //produces outgoing events
    private syncStateDb!:SyncStateDb;

    //private pathMapper:PathMapper;
    private queueScheduler:QueueScheduler;

    private pingServer:boolean=true; //if set to false the ping loop will stop
    private pingPeriod:number=0;
    //private performReconnection:boolean=true;

    constructor(config:Config){
        this.config=config;
        //this.host= config.host;
        if(!this.config.pathToWatch) throw new Error("missing path to watch");
        //this.pathMapper= new PathMapper(this.config.pathToWatch);
        //this.localRootFolder= this.pathMapper.getAbsoluteLocalPath();
        this.client = new FileTransferClient(config)
        //this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            //avoid reconnection
            //this.performReconnection=false;
            //if(this.client) this.client.close();
            if(this.watcher) this.watcher.close();
            console.log("onBeforeExit: closed client and watcher")
        })
        this.queueScheduler= new QueueScheduler(this);
    }

    
    async start(){
        //*Print parameters
        console.log("Watching directory:",this.config.pathToWatch)
        //console.log("FTP Root path:",this.ftpRootFolder)
        console.log("FTP connection parameters:")
        console.log("- host:",(this.config.autoConnect?"autoconnect":this.config.host))
        console.log("- port:",this.config.port)
        console.log("- user:",this.config.user)
        /*//let host="";
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
        await this.connectAndSync()*/

        //*Connect to server and set work dir
        await this.client.connect();
        const remotePwd= await this.client.pwd();
        //Initialize classes
        PathMapper.setLocalAndRemotePaths(this.config.pathToWatch,remotePwd); //*INIT PATH MAPPER
        this.syncStateDb= new SqliteSyncStateDb("../test_appdata",PathMapper.getLocalRootPath()) //todo: manage appdata better


        //*Synchronize
        await this.client.ensureWorkDir();//Ensure both local and remote directory are present
        //Now we are in work dir
        //let res=await this.client.getRemoteFileChecksum("mao/bubus.txt")
        //console.log(res)
        // res=await this.client.getRemoteFileChecksum("mao\\bubus.txt")
        //console.log(res)
        //throw new Error("MAO")
        await this.synchronize();

        //ping every 15s
        this.pingPeriod= 15 * 1000
        await this.startPingServerLoop()

        //**Start watcher
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

        //*Subscribe if config=true 
        if(this.config.subscribe){
            await this.subscribe();
        }
    }

    async stop(){
        this.pingServer=false;
        if(this.client) this.client.close();
        if(this.watcher) this.watcher.close();
        //todo: stop ws connection
    }

    private async startPingServerLoop(/*ms:number*/){
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




    //SYNCHRONIZATION
    private async synchronize(){
        const syncStartTime=performance.now();
        logger.info("Synchronizing with server...")
        //**GENERATE FSTREES
        logger.info("generating file-system trees")
        const treeGenStartTime= performance.now();
        const localGenerator= new LocalFSTreeGenerator();
        const remoteGenerator= new FTPRemoteFsTreeGenerator(this.client);
        //Generate local and remote tree
        const localTreeRoot= await localGenerator.generateFSTreeFromPath(PathMapper.getLocalRootPath(),false);
        const remoteTreeRoot= await remoteGenerator.generateFSTreeFromPath("./");//WE ALREADY CD INTO WORKING DIR //this.ftpRootFolder);
        //Get last sync state tree
        let lastSyncLocalTreeRoot= await this.syncStateDb.getDbAsFSNode();
        if(!lastSyncLocalTreeRoot) lastSyncLocalTreeRoot= new DirectoryNode("",PathMapper.getLocalRootPath(),{name:"",size:0,mtime:new Date(),isDirectory:true});
        //Print trees   
        await this.prettyprint_fstree("Local",localTreeRoot)
        await this.prettyprint_fstree("LastSync",lastSyncLocalTreeRoot)
        await this.prettyprint_fstree("Remote",remoteTreeRoot)
        logger.info("generated fs trees - "+(performance.now()-treeGenStartTime)+"ms")

        //**CHECK DIFFS
        logger.info("checking for differences between local and remote")
        const recursive=false; //if true explore local-only or remote-only directories, and include all the inside differences to diff
        const diffCheckerVisitor= new ComparisonFSTreeVisitor(remoteTreeRoot,this.client,recursive);
        await localTreeRoot.accept(diffCheckerVisitor);
        const diffList= diffCheckerVisitor.getDiffList();
        logger.info("found "+diffList.length+" differences")
        //todo: check diffs between last sync and local
        let lastSyncDiffList:DiffEntry[]=[];
        if(lastSyncLocalTreeRoot){
            logger.info("checking for differences between local and last sync db")
            const lastSyncDiffCheckerVisitor= new ComparisonFSTreeVisitor(lastSyncLocalTreeRoot,this.client,recursive); //!non usiamo il client perchè abbiamo tutti i checksum
            await localTreeRoot.accept(lastSyncDiffCheckerVisitor);
            lastSyncDiffList= lastSyncDiffCheckerVisitor.getDiffList();
            logger.info("found "+lastSyncDiffList.length+" differences")
        }

        if(diffList.length>0){
            logger.info("merging changes...")
            const conflicts= await this.mergeDiffs(diffList,lastSyncDiffList);
            if(conflicts.length==0){
                logger.info("merge completed, found "+conflicts.length+" conflicts")
            }else{
                throw new Error("merge failed to complete, found "+conflicts.length+" conflicts")
            }
        }

        //**recreate local tree fs and Save last sync state to db
        const syncedLocalTreeRoot= await localGenerator.generateFSTreeFromPath(PathMapper.getLocalRootPath(),true); //todo: include checksums flag
        await this.syncStateDb.recreateDbFromFSNode(syncedLocalTreeRoot)
        logger.info("Synchronization completed! - "+(performance.now()-syncStartTime)+"ms")
    }

    private async mergeDiffs(diffList:DiffEntry[],lastSyncDiffList:DiffEntry[]): Promise<DiffEntry[]>{
        const conflicts:DiffEntry[]=[] //diff entries which couldn't be resolved
        for(const diffEntry of diffList){
            if(diffEntry.type=="changed"){
                //se anche sync è changed, CONFLICT! else cambiato da remoto, DOWNLOAD
                const syncDiffEntry= this.getCorrespondingLastSyncDbDiff(diffEntry,lastSyncDiffList)
                const localTime=diffEntry.localNode?.data.mtime as Date;
                const remoteTime=diffEntry.remoteNode?.data.mtime as Date;
                if(syncDiffEntry==null){//sync==local
                    if(localTime<remoteTime){
                        //DOWNLOAD (cambiamenti da remoto)
                        console.log("download "+diffEntry.localNode?.path)
                        await this.client.download(diffEntry.localNode?.path as string);
                    }else{
                        //CONFLICT
                        console.log("conflict "+diffEntry.localNode?.path)
                        conflicts.push(diffEntry)
                    }
                }else if(syncDiffEntry.type=="changed"){ //sync!=local
                    const syncChecksum= syncDiffEntry.remoteNode?.data.checksum;
                    let remoteChecksum= diffEntry.remoteNode?.data.checksum;
                    if(!remoteChecksum) remoteChecksum= await this.client.getRemoteFileChecksum(diffEntry.remoteNode?.path as string);
                    if(syncChecksum==remoteChecksum && localTime>remoteTime){
                        //UPLOAD (cambiamenti offline)
                        console.log("upload "+diffEntry.localNode?.path)
                        await this.client.upload(diffEntry.localNode?.path as string);
                    }else{
                        //CONFLICT
                        console.log("conflict "+diffEntry.localNode?.path)
                        conflicts.push(diffEntry)
                    }
                }else if(syncDiffEntry.type=="local-only"){ //no si si
                    //CONFLICT
                    console.log("conflict "+diffEntry.localNode?.path)
                    conflicts.push(diffEntry)
                }
            }else if(diffEntry.type=="local-only"){
                //se anche sync è local-only, aggiunto file offline, UPLOAD
                //else if sync!=local -> CONFLICT (modificato offline), else: REMOVE FROM LOCAL
                const syncDiffEntry= this.getCorrespondingLastSyncDbDiff(diffEntry,lastSyncDiffList)
                if(syncDiffEntry==null){ //si si no
                    //REMOVE FROM LOCAL (rimosso da remoto)
                    console.log("remove from local "+diffEntry.localNode?.path);
                    const {local} = PathMapper.getLocalAndRemoteTargetPath(diffEntry.localNode?.path as string)
                    fs.unlinkSync(local);
                }else if(syncDiffEntry.type=="local-only"){ //no si no
                    //UPLOAD (aggiunto offline)
                    if(diffEntry.localNode?.data.isDirectory){
                        console.log("upload dir "+diffEntry.localNode?.path)
                        //await this.client.uploadFromDir(targetPath,remoteTargetPath);
                        await this.client.uploadDir(diffEntry.localNode?.path as string)
                    }else{
                        console.log("upload file "+diffEntry.localNode?.path)
                        await this.client.upload(diffEntry.localNode?.path as string);
                    }
                }else if(syncDiffEntry.type=="changed"){
                    //CONFLICT
                    console.log("conflict "+diffEntry.localNode?.path)
                    conflicts.push(diffEntry)
                }
            }else if(diffEntry.type=="remote-only"){
                //if sync is remote-only and sync == remote -> REMOVE FROM REMOTE, else CONFLICT
                //else no no si -> aggiunto da remoto, DOWNLOAD (noDiff,remoteOnly)
                const syncDiffEntry= this.getCorrespondingLastSyncDbDiff(diffEntry,lastSyncDiffList)
                if(syncDiffEntry==null){//no no si
                    //DOWNLOAD (aggiunto da remoto)
                    if(diffEntry.localNode?.data.isDirectory){
                        console.log("download dir "+diffEntry.remoteNode?.path)
                        await this.client.downloadDir(diffEntry.remoteNode?.path as string);
                    }else{
                        console.log("download file "+diffEntry.remoteNode?.path)
                        await this.client.download(diffEntry.remoteNode?.path as string);
                    }
                }else if(syncDiffEntry.type=="remote-only"){//si no si
                    //REMOVE FROM REMOTE OR CONFLICT?
                    if(!diffEntry.remoteNode?.data.isDirectory){
                        //Manage file
                        const syncChecksum= syncDiffEntry.remoteNode?.data.checksum;
                        let remoteChecksum= diffEntry.remoteNode?.data.checksum;
                        if(!remoteChecksum) remoteChecksum= await this.client.getRemoteFileChecksum(diffEntry.remoteNode?.path as string);
                        if(syncChecksum==remoteChecksum){
                            //REMOVE FROM REMOTE (rimosso offline)
                            console.log("remove file from remote "+diffEntry.remoteNode?.path)
                            await this.client.removeFromRemote(diffEntry.remoteNode?.path as string);
                        }else{
                            //CONFLICT
                            console.log("conflict "+diffEntry.remoteNode?.path)
                            conflicts.push(diffEntry)
                        }
                    }else{
                        //Manage directory
                        //Non posso usare i checksum, devo vedere se contiene file cambiati
                        //Compare sync tree e remote tree
                        const syncTreeBranch= syncDiffEntry.remoteNode as DirectoryNode;
                        const ftpTreeBranch= diffEntry.remoteNode as DirectoryNode;
                        const comparator= new ComparisonFSTreeVisitor(ftpTreeBranch,this.client,false);
                        await syncTreeBranch.accept(comparator);
                        const branchDiffList= comparator.getDiffList();
                        if(branchDiffList.length==0){
                            //NO DIFFERENCES BETWEEN DIRS, OK!
                            //REMOVE FROM REMOTE (rimosso offline)
                            console.log("remove dir from remote "+diffEntry.remoteNode?.path)
                            await this.client.removeDirFromRemote(diffEntry.remoteNode?.path as string);
                        }else{
                            //CONFLICT
                            console.log("conflict "+diffEntry.remoteNode?.path)
                            conflicts.push(diffEntry)
                        }
                    }
                }
            }
            /*
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
            */
        }
        return conflicts;
    }

    private getCorrespondingLastSyncDbDiff(diffEntry:DiffEntry,lastSyncDiffList:DiffEntry[]): DiffEntry|null{
        let diffEntryLocalPath= diffEntry.type=="remote-only"?
            (diffEntry.remoteNode as FileSystemNode).path:(diffEntry.localNode as FileSystemNode).path
        const res1= PathMapper.getLocalAndRemoteTargetPath(diffEntryLocalPath)
        diffEntryLocalPath=res1.local;

        for(const lastSyncDiffEntry of lastSyncDiffList){
            let pathToCompare= lastSyncDiffEntry.type=="remote-only"?
                (lastSyncDiffEntry.remoteNode as FileSystemNode).path:(lastSyncDiffEntry.localNode as FileSystemNode).path
            const res2= PathMapper.getLocalAndRemoteTargetPath(pathToCompare)
            pathToCompare=res2.local;
            if(diffEntryLocalPath==pathToCompare) return lastSyncDiffEntry;
        }
        return null;
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
        const targetPath= event.data.targetPath as string

        //PING THE SERVER CONTINUOUSLY TO KEEP ALIVE THE CONNECTION
        if(watcherEvent=="ping"){
            await this.client.pwd();
            this.wait(this.pingPeriod).then(()=>{
                this.startPingServerLoop();
            })
            return;
        }
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
            const res1= PathMapper.getLocalAndRemoteTargetPath(targetPath);
            if(cmdPath==res1.remote){
                console.log("Skipped change notification because it matches the last server command: "+cmdName)
                previousServerCommands.shift(); //delete last server notification
                return;
            }
        }

        switch (watcherEvent) {
            case "change":
                await this.client.upload(targetPath);
                logger.info("uploaded changed file "+targetPath)
                break;
            case "add":
                await this.client.upload(targetPath);
                logger.info("added file "+targetPath)
                break;
            case "addDir":
                await this.client.uploadDir(targetPath); //TODO: USE TREE INSTEAD OF UPLOADING WHOLE DIR AT ONCE
                logger.info("added directory "+targetPath)
                break;
            case "rename":
                var targetPathNext= event.data.targetPathNext as string;
                await this.client.renameRemote(targetPath, targetPathNext);
                logger.info("renamed file "+targetPath+" to "+targetPathNext)
                break;
            case "renameDir":
                var targetPathNext= event.data.targetPathNext as string;
                await this.client.renameRemote(targetPath, targetPathNext);
                logger.info("renamed dir "+targetPath+" to "+targetPathNext)
                break;
            case "unlink":
                await this.client.removeFromRemote(targetPath);
                logger.info("removing file ",targetPath)
                break;
            case "unlinkDir": //!THIS HAS STRANGE PATH
                await this.client.removeDirFromRemote(targetPath);
                logger.info("removing directory from remote path:",targetPath)
                break;
            default:
                logger.warn("skipping unknown event:",event)
                break;
        }
    }

    //TODO: Sync with lastSyncDb
    async onWsQueueNotification(event: QueueEvent){
        const command= event.data.command as string;
        console.log("Received command notification from server:",command)
        const commandName= command.split(" ")[0];
        const remoteTargetPath= command.split(" ")[1];
        const res= PathMapper.getLocalAndRemoteTargetPath(remoteTargetPath);
        const targetPath= res.local;
        
        switch(commandName){
            case "STOR":
                await this.client.download(targetPath);
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
                const res2= PathMapper.getLocalAndRemoteTargetPath(remoteTargetPathNext);
                const targetPathNext= res2.local;
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



    //---UTILS---
    private async prettyprint_fstree(name:string, tree:DirectoryNode){
        const printer= new PrintFSTreeVisitor();
        const totalSizeVisitor= new TotalSizeFSTVisitor();
        console.log("## "+name+":")
        await tree.accept(printer);
        await tree.accept(totalSizeVisitor);
        console.log("size: "+totalSizeVisitor.getTotalSize()+" bytes")
    }

    //Others
    private async wait(ms:number){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
    }
    private async ping(){
        await this.client.pwd();
    }
}