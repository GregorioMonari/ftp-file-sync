import Client from "./app/Client";
import OpenPortsFinder from "./app/discovery/OpenPortsFinder";
import { Config } from "./interfaces/config.interface";
import CLIArgsMapper from "./utils/CLIArgsMapper";
import logger from "./utils/logger";

main();

 
async function main(){
    //Set cli args configuration
    const cliArgsMapper= new CLIArgsMapper();
    cliArgsMapper.addPositionalArgument("command","sync dir, remove dir, discover services")
    cliArgsMapper.addPositionalArgument("pathToWatch")
    cliArgsMapper.addArgument("-loglevel")
    cliArgsMapper.addArgument("-host")
    cliArgsMapper.addArgument("-ftpPort")
    cliArgsMapper.addArgument("-user")
    cliArgsMapper.addArgument("-password")
    cliArgsMapper.addFlag("-subscribe")
    cliArgsMapper.addArgument("-wsPort")
    cliArgsMapper.addFlag("-v","enable verbose logging, allows to see underlying ftp and ws protocol requests")
    cliArgsMapper.addFlag("-d","enables autoconnect to ftp servers connected in the local network. Host parameter will be ignored")
    if(cliArgsMapper.getArgsAsList().length==0 || cliArgsMapper.getArgsAsList()[0].toLowerCase().includes("help")) {
        cliArgsMapper.printFormattedHelp();
        return;
    }

    //Begin
    console.log("====================")
    console.log("| FTP Synchronizer |")
    console.log("====================")
    const argsMap= cliArgsMapper.getArgsAsJson()
    //if(argsMap.logLevel) logger.level=argsMap.logLevel as string;
    const config:Config={
        pathToWatch: argsMap.pathToWatch as string, //"../shared_test_folder",
        host: argsMap.host as string||"localhost", //"localhost",
        port: parseInt(argsMap.ftpPort as string)||21, //21, //2121,
        user: "myuser",
        password: "mypass",
        timeout: 60000,
        subscribe: argsMap.subscribe as boolean||false,
        wsPort: parseInt(argsMap.wsPort as string)||9666,
        autoConnect: argsMap.d as boolean||false,
        verbose: argsMap.v as boolean||false,
    }

    //MANAGE COMMANDS
    switch (argsMap.command) {
        case "sync":
            const synchronizer= new Client(config);
            await synchronizer.start();
            break;
        case "remove":
            throw new Error("TBI")
            break;
        case "discover":
            if(!argsMap.pathToWatch) throw new Error("please specify port to discover, es. npm run start:build -- discover 21")
            const discoverPort= parseInt(argsMap.pathToWatch as string)
            const finder= new OpenPortsFinder(100); //timeout 100s
            console.log(finder.getCidrMap())
            console.log("Discovering services connected locally and listening on port: "+discoverPort)
            const serverIps= await finder.findLocalServers(discoverPort,false) //stop at first
            console.log("Found "+serverIps.length+" services. Ip List:")
            for(const ip of serverIps){
                console.log(ip)
            }
            break;
        default:
            console.log("unknown command: "+argsMap.command+", closing application")
            break;
    }
}