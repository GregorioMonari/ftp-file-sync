import ClientSynchronizer from "./app/ClientSynchronizer";
import { Config } from "./interfaces/config.interface";
import CLIArgsMapper from "./utils/CLIArgsMapper";
import logger from "./utils/logger";

main();

 
async function main(){
    //Set cli args configuration
    const cliArgsMapper= new CLIArgsMapper();
    cliArgsMapper.addPositionalArgument("pathToWatch")
    cliArgsMapper.addArgument("-loglevel")
    cliArgsMapper.addArgument("-host")
    cliArgsMapper.addArgument("-ftpPort")
    cliArgsMapper.addArgument("-user")
    cliArgsMapper.addArgument("-password")
    cliArgsMapper.addFlag("-subscribe")
    cliArgsMapper.addArgument("-wsPort")
    cliArgsMapper.addFlag("-v","enable verbose logging, allows to see underlying ftp and ws protocol requests")
    if(cliArgsMapper.getArgsAsList()[0].toLowerCase().includes("help")) {
        cliArgsMapper.printFormattedHelp();
        return;
    }

    //Begin
    console.log("=======================")
    console.log("| Client Synchronizer |")
    console.log("=======================")
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
        verbose: argsMap.v as boolean||false,
    }
    const synchronizer= new ClientSynchronizer(config);
    await synchronizer.start();
}


/*//!TEST
const recentDate= parseUNIXLsDate('Dec 31 7:48')
const oldDate= parseUNIXLsDate('Feb 25 2023')
const recentDate2= parseUNIXLsDate('Aug 26 7:48')
console.log(recentDate)
console.log(oldDate)
console.log(recentDate2)
//!TEST
//throw new Error("TESTING")
return
*/