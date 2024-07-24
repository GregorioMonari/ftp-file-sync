import { Config } from "./interfaces/config.interface";
//import Watcher from "watcher"; //!BUGGED

export default class FileSystemWatcher{
    protected config:Config;
    private watcher:any;
    constructor(config:Config){
        this.config=config;
    }

    async start(){
        this.watcher= await this.buildWatcher();
    }

    async buildWatcher(){
        const {default:Watcher}= await import("watcher");
        const watcherInstance = new Watcher ( '/foo/bar' );
        return watcherInstance;
    }

    onLocalChangeEvent(){
        //update ftp server
    }
}