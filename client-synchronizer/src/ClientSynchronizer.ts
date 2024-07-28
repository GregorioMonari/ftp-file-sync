import * as fs from "fs";
import * as ftp from "basic-ftp";
import WebSocket, {MessageEvent} from "ws";
import { importEsmModule } from "./utils/esm-compatibility";
import type Watcher from "watcher";
import { Config } from "./interfaces/config.interface";
import WsConnector from "./WsConnector";
import PathMapper from "./PathMapper";
import { QueueEvent } from "./interfaces/queue-event.interface";
import QueueSyncProcessor from "./processing/QueueSyncProcessor";

export default class ClientSynchronizer{
    private config:Config;
    private localRootFolder:string;
    private ftpRootFolder:string;

    private client:ftp.Client; //handle file upload/download
    private webSocket!:WebSocket; //captures incoming events
    private watcher!:Watcher; //produces outgoing events

    private pathMapper:PathMapper;
    private queueProcessor:QueueSyncProcessor;

    constructor(config:Config){
        this.config=config;
        this.pathMapper= new PathMapper(this.config.pathToWatch);

        this.localRootFolder= this.pathMapper.getAbsoluteLocalPath();
        this.ftpRootFolder= this.pathMapper.getFtpRootFolder(this.localRootFolder)

        this.client = new ftp.Client(this.config.timeout)
        this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            this.client.close();
            this.watcher.close()
            console.log("onBeforeExit: closed client and watcher")
        })
        this.queueProcessor= new QueueSyncProcessor(this);
    }

    async start(){
        //Print parameters
        console.log("File Watcher path:",this.localRootFolder)
        console.log("FTP Root path:",this.ftpRootFolder)
        console.log("FTP connection parameters:")
        console.log("- host:",this.config.host)
        console.log("- user:",this.config.user)
        console.log("====================================")

        //Connect to Ftp
        console.log("Connecting to FTP server...")
        await this.client.access({
            host: this.config.host,
            port: this.config.port||21,
            user: this.config.user,
            password: this.config.password,
            secure: this.config.secure||false // Set to true if you are using FTPS
        })
        console.log("Connected to Ftp, login succeeded")

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
        this.watcher.on ( 'all',father.onWatcherMessage);

        //Subscribe to WebSocket and handle incoming events
        const wsConnector= new WsConnector(this.config,this.client);
        this.webSocket= await wsConnector.subscribe();
        this.webSocket.on("message",father.onWsMessage)
    }


    async synchronize(){
        //Ensure both local and remote directory are present
        const remoteExists= await this.isFtpRootFolderPresent();
        const localExists= await this.isLocalRootFolderPresent();
        //If either one is missing, download/upload
        if(!localExists)
            throw new Error("Local path does not exist. Please create the folder you are trying to watch. TBI: enable auto create")
        if(localExists && !remoteExists){
            //Upload
            console.log("Root ftp folder not present, creating one") 
            await this.client.ensureDir(this.ftpRootFolder) //also cd's into the specified path
            await this.client.clearWorkingDir() //ensure directory is empty
            await this.client.uploadFromDir(this.localRootFolder) //upload to working directory if rootPath is undefined 
            return;
        }

        //If we are here, both directories exist. Cd into workding dir and sync with timestamps
        await this.client.cd(this.ftpRootFolder)
        //TODO: If both are present, check last modification to synchronize
        console.log("TBI: handle synch if local and remote exist")
    }

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



    //Add Inbound and Outbound events to queue
    async onWatcherMessage(event:string, targetPath:string, targetPathNext?:string ){
        this.queueProcessor.watcherQueue.add({
            type: "watcher",
            data: {event,targetPath,targetPathNext:targetPathNext||null}
        })
    }

    async onWsMessage(event: MessageEvent){
        //TODO: HERE FILTER RENAMES, DO NOT SEND THE FIRST RN COMMAND TO QUEUE
        //Send both commands at once as a ws notficiation
        this.queueProcessor.watcherQueue.add({
            type: "websocket",
            data: {command: event.data.toString()}
        })
    }

    //Manage queue notifications
    async onWatcherQueueNotification(event: QueueEvent){
        const watcherEvent= event.data.event;
        const targetPath= event.data.targetPath as string;
        const remoteTargetPath= this.pathMapper.getRemoteTargetPath(targetPath);

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
                //await this.client.uploadFrom(targetPath, remoteTargetPath);
                console.log("TBI")
                break;
            case "renameDir":
                //await this.client.uploadFrom(targetPath, remoteTargetPath);
                console.log("TBI")
                break;
            case "unlink":
                await this.client.remove(remoteTargetPath);
                console.log("removing file from remote path:",remoteTargetPath)
                break;
            case "unlinkDir":
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
        const remoteTargetPath= command.split("")[1];
        const targetPath= this.pathMapper.getLocalTargetPath(remoteTargetPath);
        /*
        switch(commandName){
            case "STOR":
                await this.client.downloadTo(targetPath, remoteTargetPath);
                console.log("uploaded changed file to remote path:",remoteTargetPath)
                break;
            default:
                console.log("skipping unknown event:",command)
                break;
        }
        */
    }
}