import Client from "../../src/app/Client"
import * as ftp from "basic-ftp";
import { Config } from "../../src/interfaces/config.interface";


export async function createIntegrationTestResources() {
    const config:Config={
        pathToWatch: "./test/test_folder", //"../shared_test_folder",
        host: "localhost", //"localhost",
        port: 21, //21, //2121,
        user: "myuser",
        password: "mypass@1234",
        timeout: 60000,
        subscribe: false,
        wsPort: 9666,
        autoConnect: false,
        verbose: true,
    }
    const clientSync= new Client(config); //access needs to be tested

    const ftpClient = new ftp.Client(60000)
    //ftpClient.verbose=false;
    await ftpClient.access({
        host: "localhost",
        port: 21,
        user: "myuser",
        password: "mypass@1234",
        secure: false // Set to true if you are using FTPS
    })

    return {
        clientSync,
        ftpClient
    }
}

export async function destroyIntegrationTestResources(resources:{
    clientSync:Client;
    ftpClient:ftp.Client;
}){
    await resources.clientSync.stop();
    resources.ftpClient.close();
}