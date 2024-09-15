import SyncStateDb from "../SyncStateDb";
import { FileSystemNode,DirectoryNode } from "../../../../lib/filesystem-tree-visitor/FileSystemNode";
import { FSNodeJson } from "../../../../lib/filesystem-tree-visitor/serialization-base/fs-node-json.interface";
import { fst_deserialize, fst_serialize } from "../../../../lib/filesystem-tree-visitor/serialization";
import * as fs from "fs";
import path from "path";

export default class JsonSyncStateDb extends SyncStateDb{
    private dbFilePath:string;
    constructor(appDataPath:string, dbName:string){
        super(appDataPath,dbName)
        if(!this.dbFolderExists()) throw new Error("Missing SyncStateDb folder: "+appDataPath)
        this.dbFilePath= path.join(this.appDataPath,"sync-state.db.json")
    }
    async recreateDbFromFSNode(data:DirectoryNode){
        this.ensureDbFile();
        const fileString= fs.readFileSync(this.dbFilePath).toString();
        const dbJson= JSON.parse(fileString)
        //Add data
        const syncedLocalTreeRootJson= await fst_serialize(data)
        dbJson[this.dbName]=syncedLocalTreeRootJson;
        //Update file
        const dbString= JSON.stringify(dbJson);
        fs.writeFileSync(this.dbFilePath,dbString)
    }
    async getDbAsFSNode(): Promise<DirectoryNode|null>{
        this.ensureDbFile();
        const fileString= fs.readFileSync(this.dbFilePath).toString();
        const dbJson= JSON.parse(fileString)
        if(dbJson.hasOwnProperty(this.dbName)){
            const lastSyncStateJson= dbJson[this.dbName]
            let lastSyncLocalTreeRoot:DirectoryNode|null= null;
            if(lastSyncStateJson!=null) lastSyncLocalTreeRoot= await fst_deserialize(lastSyncStateJson) 
            return lastSyncLocalTreeRoot;
        }else{
            return null;
        }
    }

    
    private ensureDbFile(){
        if(!fs.existsSync(this.dbFilePath)){
            fs.writeFileSync(this.dbFilePath,"{}")
        }
    }
    private dbFolderExists(){
        return fs.existsSync(this.appDataPath);
    }
}