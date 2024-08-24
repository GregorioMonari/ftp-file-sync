import ClientSynchronizer from "./app/ClientSynchronizer";
import LocalFSTreeGenerator from "./app/filesystem-tree/LocalFsTreeGenerator";
import PrintFSTreeVisitor from "./app/filesystem-tree/PrintFSTreeVisitor";
import { Config } from "./interfaces/config.interface";

console.log("=======================")
console.log("| Client Synchronizer |")
console.log("=======================")
main();

 
async function main(){
    const config:Config={
        host: "localhost",
        port: 21, //2121,
        wsPort: 9666,
        user: "myuser",
        password: "mypass",
        timeout: 60000,
        verbose: false,
        pathToWatch: "../shared_test_folder"
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
