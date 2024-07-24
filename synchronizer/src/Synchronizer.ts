import * as ftp from "basic-ftp";
import { Config } from "./interfaces/config.interface";
import FileSystemWatcher from "./FileSystemWatcher";

export default class Synchronizer extends FileSystemWatcher{
    private client:ftp.Client;
    constructor(config:Config){
        super(config);
        this.client = new ftp.Client(this.config.timeout)
        this.client.ftp.verbose = this.config.verbose||false;
        process.on("beforeExit",()=>{
            this.client.close();
            console.log("onBeforeExit: closed client")
        })
    }

    //Connect
    async start(){
        await super.start();
        console.log("# Starting ftp synchronizer")
        console.log("Ftp connection parameters:")
        console.log("- host:",this.config.host)
        console.log("- user:",this.config.user)
        await this.connectToFtp();
    }

    async connectToFtp() {
        const startTime= performance.now()
        console.log("Connecting to ftp server...")
        try {
            await this.client.access({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                secure: this.config.secure||false // Set to true if you are using FTPS
            })
            // Example: List directory contents
            const list = await this.client.list()
            //console.log(list)
            console.log("Connected to FTP server in",((performance.now()-startTime)).toFixed(2)+"ms")
        }catch(e){console.log(e)}
    }


    override onLocalChangeEvent(){
        //update ftp server
    }


    //TODO: POLL FOR FILE CHANGES IN THE SERVER EVERY MINUTE
    //TODO: or you could use this same exact script to generate events from the ftp server, reducing load
    //TODO:     But i think you can do it later, also you can add the api later and the frontend
    //TODO:     Focus on this script for now
    onServerChangeEvent(){
        //Update local fileSystem
    }
}