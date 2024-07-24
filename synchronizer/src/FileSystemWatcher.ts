import { Config } from "./interfaces/config.interface";
import { importEsmModule } from "./utils/esm-compatibility";
import type Watcher from "watcher";

export default class FileSystemWatcher{
    protected config:Config;
    protected watcher!:Watcher;
    constructor(config:Config){
        this.config=config;
    }

    async listen(ignoreInitial?:boolean){
        this.watcher= await this.buildWatcher(ignoreInitial||false);
        await this.attachEventListeners();
    }

    async buildWatcher(ignoreInitial:boolean){
        const rootPathToWatch= this.config.pathToWatch;
        const WatcherModule:any = await importEsmModule<typeof Watcher>("watcher");
        const watcherInstance:Watcher = new WatcherModule.default (rootPathToWatch,{
            ignoreInitial
        });
        return watcherInstance;
    }

    async attachEventListeners(){
        //this.watcher.on ( 'all', ( event, targetPath, targetPathNext ) => {
        //console.log ( event ); // => could be any target event: 'add', 'addDir', 'change', 'rename', 'renameDir', 'unlink' or 'unlinkDir'
        //console.log ( targetPath ); // => the file system path where the event took place, this is always provided
        //console.log ( targetPathNext ); // => the file system path "targetPath" got renamed to, this is only provided on 'rename'/'renameDir' events
        //});
        this.watcher.on ( 'add', filePath => {
        console.log ( filePath ); // "filePath" just got created, or discovered by the watcher if this is an initial event
        });
        this.watcher.on ( 'addDir', directoryPath => {
        console.log ( directoryPath ); // "directoryPath" just got created, or discovered by the watcher if this is an initial event
        });
        this.watcher.on ( 'change', filePath => {
        console.log ( filePath ); // "filePath" just got modified
        });
        this.watcher.on ( 'rename', ( filePath, filePathNext ) => {
        console.log ( filePath, filePathNext ); // "filePath" got renamed to "filePathNext"
        });
        this.watcher.on ( 'renameDir', ( directoryPath, directoryPathNext ) => {
        console.log ( directoryPath, directoryPathNext ); // "directoryPath" got renamed to "directoryPathNext"
        });
        this.watcher.on ( 'unlink', filePath => {
        console.log ( filePath ); // "filePath" got deleted, or at least moved outside the watched tree
        });
        this.watcher.on ( 'unlinkDir', directoryPath => {
        console.log ( directoryPath ); // "directoryPath" got deleted, or at least moved outside the watched tree
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

    onLocalChangeEvent(){
        //update ftp server
    }
}