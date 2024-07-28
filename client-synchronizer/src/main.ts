import ClientSynchronizer from "./ClientSynchronizer";
import { Config } from "./interfaces/config.interface";

console.log("=======================")
console.log("| Client Synchronizer |")
console.log("=======================")
main();

 
async function main(){
    const config:Config={
        host: "localhost",
        port: 2121,
        wsPort: 9666,
        user: "myuser",
        password: "mypass",
        timeout: 60000,
        verbose: true,
        pathToWatch: "../shared_test_folder"
    }
    const synchronizer= new ClientSynchronizer(config);
    await synchronizer.start();
}
