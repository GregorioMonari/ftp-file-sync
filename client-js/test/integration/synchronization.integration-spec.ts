import Client from "../../src/app/Client"
import * as ftp from "basic-ftp";
import * as fs from "fs";
import { 
    createIntegrationTestResources, 
    destroyIntegrationTestResources 
} from "../utils/resources";

/*//!npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful. */
describe("client synchronizer",()=>{
    let clientSync:Client;
    let ftpClient:ftp.Client;
    let testFolderPath:string="./test/test_folder";
    let remoteTestFolderPath:string="/ftp/myuser/test_folder";

    beforeEach(async ()=>{
        const {clientSync:sync,ftpClient:client}= await createIntegrationTestResources();
        clientSync= sync;
        ftpClient= client;
        if(fs.existsSync(testFolderPath)){
            fs.rmSync(testFolderPath,{recursive:true,force:true})
            fs.mkdirSync(testFolderPath)
        }else{ 
            fs.mkdirSync(testFolderPath)
        }
        console.log(await ftpClient.pwd()) 
        await ftpClient.cd("/ftp/myuser")
        console.log(await ftpClient.pwd()) 
        await ftpClient.clearWorkingDir()
    })
    afterEach(async ()=>{
        await destroyIntegrationTestResources({
            clientSync,
            ftpClient
        });
    })

    describe('synchronize', () => {
        it('should upload test_folder if missing in remote', async () => {
            //Create test filesystem
            fs.writeFileSync(testFolderPath+"/prova1.txt","hello!")
            fs.writeFileSync(testFolderPath+"/prova2.txt","hello2!")
            fs.mkdirSync(testFolderPath+"/nested")
            fs.writeFileSync(testFolderPath+"/nested/nestedFile1.txt","wow!")
            await clientSync.connectAndSync();
            //Now files should be present in the ftp server
            await ftpClient.cd(remoteTestFolderPath)
            const res= await ftpClient.list();
            expect(res.length).toBeGreaterThan(0);
        })
    })
})