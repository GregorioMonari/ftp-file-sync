import * as ftp from "basic-ftp";
import { Config } from "./interfaces/config.interface";
import FileSystemWatcher from "./FileSystemWatcher";
import path from "path";
import WebSocket, {MessageEvent} from "ws";

export default class Synchronizer extends FileSystemWatcher{
    private client:ftp.Client;
    private localRootFolder:string;
    private ftpRootFolder:string;
    private webSocket!: WebSocket;
    constructor(config:Config){
        super(config);
        this.localRootFolder= path.resolve(config.pathToWatch)
        this.ftpRootFolder= this.getFtpRootFolder(this.localRootFolder)
        this.client = new ftp.Client(this.config.timeout)
        this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            this.client.close();
            this.watcher.close()
            console.log("onBeforeExit: closed client and watcher")
        })
    }

    getFtpRootFolder(localRootFolder:string){
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

    //Connect
    async start(){
        console.log("File Watcher path:",this.localRootFolder)
        console.log("FTP Root path:",this.ftpRootFolder)
        console.log("FTP connection parameters:")
        console.log("- host:",this.config.host)
        console.log("- user:",this.config.user)
        console.log("====================================")
        await this.connectToFtp();
        await this.assertFtpRootFolderExists();

        //GET ID TO SUBSCRIBE
        await this.subscribe();
    }

    async subscribe(){
        const response= await this.client.send("PROXYCONNID")
        console.log("Received connection id: ",response)

        if(response.code!=200){
            throw new Error("Error while subscribing to ws proxy: "+response.message)
        }

        //Open websocket
        const scope=this;
        this.webSocket = new WebSocket(`ws://${this.config.host}:${this.config.wsPort||8085}`);

        this.webSocket.on("open", () => {
            console.log("WebSocket connection opened");

            const onDataCb= scope.onServerChangeNotification;
            const onStreamEvent= (event: MessageEvent)=>{
                if(event.data.toString().startsWith("ok")){
                    scope.webSocket.removeEventListener("message",onStreamEvent)
                    scope.webSocket.addEventListener("message",onDataCb)
                    console.log("ws link successful, listening to ftp change events")
                }
            }
    
            scope.webSocket.addEventListener("message",onStreamEvent)
            scope.webSocket.send(response.message.split(" ")[1]);
        });
    }


    async assertFtpRootFolderExists(){
        const rootFolders = await this.client.list() 
        let ignoreInitial;
        let found=false;

        //Search if folder is already present
        if(rootFolders && rootFolders.length!=0){
            for(const folder of rootFolders){
                if(folder.name==this.ftpRootFolder){
                    found=true;
                    break;
                }
            }
        }


        if(found){
            ignoreInitial=true;
            console.log("Root FTP folder found, ignoring initial fs changes")
            await this.client.cd(this.ftpRootFolder) //cd into working directory
            //TODO: CHECK IF THERE ARE SYNCHRONIZATION ISSUES
        }else{
            ignoreInitial=false;
            console.log("Root ftp folder not present, creating one") 
            await this.client.ensureDir(this.ftpRootFolder) //also cd's into the specified path
            await this.client.clearWorkingDir() //ensure directory is empty
            await this.client.uploadFromDir(this.localRootFolder) //upload to working directory if rootPath is undefined 
        }
        await this.listen(ignoreInitial); //ignore initial if ftp folder is empty or not found
    }

    async connectToFtp() {
        const startTime= performance.now()
        console.log("Connecting to FTP server...")
        try {
            await this.client.access({
                host: this.config.host,
                port: this.config.port||21,
                user: this.config.user,
                password: this.config.password,
                secure: this.config.secure||false // Set to true if you are using FTPS
            })
            // Example: List directory contents
            //const list = await this.client.list()
            //console.log(list)
            console.log("Connected to FTP server in",((performance.now()-startTime)).toFixed(2)+"ms")
        }catch(e){console.log(e)}
    }


    onServerChangeNotification(event: MessageEvent){
        const command= event.data.toString();
        console.log("Received command notification from server:",command)
        //Update local fileSystem
    }

    override async onLocalWatcherNotification(event:string, targetPath:string, targetPathNext?:string){
        let remoteTargetPath=targetPath.replace(this.localRootFolder,"").replace(/\\/g,"/") //consider we already cd into working dir
        if(remoteTargetPath.startsWith("/")) remoteTargetPath=remoteTargetPath.slice(1);

        switch (event) {
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

}