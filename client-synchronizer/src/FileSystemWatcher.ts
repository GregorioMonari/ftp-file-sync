import { Config } from "./interfaces/config.interface";
import { importEsmModule } from "./utils/esm-compatibility";
import type Watcher from "watcher";

export default class FileSystemWatcher{
    protected config:Config;
    protected watcher!:Watcher;
    private queue: EventsQueue;
    constructor(config:Config){
        this.config=config;
        this.queue=new EventsQueue(this,"onLocalWatcherNotification");
    }

    async listen(ignoreInitial?:boolean){
        this.watcher= await this.buildWatcher(ignoreInitial||false);
        await this.attachEventListeners();
    }

    async buildWatcher(ignoreInitial:boolean){
        const rootPathToWatch= this.config.pathToWatch;
        const WatcherModule:any = await importEsmModule<typeof Watcher>("watcher");
        const watcherInstance:Watcher = new WatcherModule.default (rootPathToWatch,{
            ignoreInitial,
            depth:20,
            recursive: true
        });
        return watcherInstance;
    }

    async attachEventListeners(){
        const father=this;
        this.watcher.on ( 'all', ( event, targetPath, targetPathNext ) => {
            //father.onLocalWatcherNotification(event, targetPath, targetPathNext)
            father.queue.add(event,targetPath,targetPathNext)
        });
        
        //OPEN AND CLOSE APP
        this.watcher.on ( 'close', () => {
        // The app just stopped watching and will not emit any further events
        });
        this.watcher.on ( 'ready', () => {
            // The app just finished instantiation and may soon emit some events
            console.log("watcher listening")
        });
    }

    async onLocalWatcherNotification( event:string, targetPath:string, targetPathNext?:string ){
        console.log("received event")
    }
}

//Execute in chain
class EventsQueue{
    private maxSize=100;
    private serverChangesQueue:any[]=[]//compare with queue to avoid sending changes when downloading from server
    private queue:any[]=[];
    private target:any;
    private callBack:any;
    constructor(target:any,callBackName:string){
        this.target=target;
        this.callBack=callBackName;
    }
    add(event:string, targetPath:string, targetPathNext?:string){
        if(this.queue.length>=this.maxSize){
            console.log("event queue is full! cannot send event:",event)
            return;
        }
        this.queue.push({event,targetPath,targetPathNext})
        if(this.queue.length==1) this.processQueue();
    }
    private async processQueue(){
        if(this.queue.length==0) return; //stop if empty
        //get first element of array
        const cell= this.queue[0];
        //process event
        try{
            await this.target[this.callBack](cell.event,cell.targetPath,cell.targetPathNext);
        }catch(e){
            console.error(e); //go on
        }
        //pop first element
        this.queue.shift();
        //Call this function recursively until queue is empty
        this.processQueue();
    }
}