import Synchronizer from "./Synchronizer";
import { Config } from "./interfaces/config.interface";

console.log("=======================")
console.log("| Client Synchronizer |")
console.log("=======================")
main();

 
async function main(){
    const config:Config={
        host: "localhost",
        port: 2121,
        user: "myuser",
        password: "mypass",
        timeout: 60000,
        verbose: true,
        pathToWatch: "../shared_test_folder"
    }
    const synchronizer= new Synchronizer(config);
    await synchronizer.start();
}
