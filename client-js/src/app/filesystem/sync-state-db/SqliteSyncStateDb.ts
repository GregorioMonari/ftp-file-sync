import SyncStateDb from "./SyncStateDb";
import { FileSystemNode,DirectoryNode } from "../../../lib/filesystem-tree-visitor/FileSystemNode";
import { FSNodeJson } from "../../../lib/filesystem-tree-visitor/serialization-base/fs-node-json.interface";
import { fst_deserialize, fst_serialize } from "../../../lib/filesystem-tree-visitor/serialization";
import * as fs from "fs";
import path from "path";
import { getStringChecksum } from "../../checksum-utils";
import { SqliteDriver } from "../../../lib/SqliteDriver";
import SqliteTableCreateFSTreeVisitor from "./SqliteTableCreateFSTreeVisitor";
import SqliteTableFSTreeGenerator from "./SqliteTableFSTreeGenerator";

const tableName="filesystem"

export default class SqliteSyncStateDb extends SyncStateDb{
    private sqliteDb:SqliteDriver;
    private dbFilePath:string;
    constructor(appDataPath:string, dbName:string){
        super(appDataPath,dbName)
        //In this case dbName is reflected in the db file name. But we cannot use a path for a filename. We can use the path checksum
        const dbNameChecksum= getStringChecksum(dbName);
        this.dbFilePath= path.join(this.appDataPath,dbNameChecksum+".db")
        this.sqliteDb= new SqliteDriver(this.dbFilePath);
        //if(!this.dbFolderExists()) throw new Error("Missing SyncStateDb file: "+this.dbFilePath)
    }
    async recreateDbFromFSNode(data:DirectoryNode){
        this.ensureDbFile()
        if(await this.sqliteDb.tableExists(tableName)){
            await this.sqliteDb.cleanTable(tableName)
        }else{
            await this.sqliteDb.createTable(tableName,{
                id: "INTEGER PRIMARY KEY",
                parent_id: "INTEGER",
                path: "TEXT NOT NULL",
                name: "TEXT",
                size: "INTEGER",
                mtime: "DATETIME",
                is_directory: "BOOLEAN NOT NULL",
                checksum: "TEXT",
                FOREIGN: "KEY (parent_id) REFERENCES filesystem(id)" //todo: better
            });
        }
        const visitor= new SqliteTableCreateFSTreeVisitor(this.sqliteDb);
        await data.accept(visitor);
    }
    async getDbAsFSNode(): Promise<DirectoryNode|null>{
        if(!fs.existsSync(this.dbFilePath)) return null;
        if(!await this.sqliteDb.tableExists("filesystem")) return null;
        if(await this.sqliteDb.tableIsEmpty("filesystem")) return null;
        //GET ROOT PATH
        const rootRecord= await this.sqliteDb.queryData("filesystem",["path"],"id=1");
        const rootPath= rootRecord[0].path as string;
        console.log("Sync db rootPath: "+rootPath)
        const generator= new SqliteTableFSTreeGenerator(this.sqliteDb);
        const tree= await generator.generateFSTreeFromPath(rootPath);
        return tree;
        /*const fileString= fs.readFileSync(this.dbFilePath).toString();
        const dbJson= JSON.parse(fileString)
        if(dbJson.hasOwnProperty(this.dbName)){
            const lastSyncStateJson= dbJson[this.dbName]
            let lastSyncLocalTreeRoot:DirectoryNode|null= null;
            if(lastSyncStateJson!=null) lastSyncLocalTreeRoot= await fst_deserialize(lastSyncStateJson) 
            return lastSyncLocalTreeRoot;
        }else{
            return null;
        }*/
    }

    
    private ensureDbFile(){
        if(!fs.existsSync(this.dbFilePath)){
            fs.writeFileSync(this.dbFilePath,"")
        }
    }
    private dbFolderExists(){
        return fs.existsSync(this.appDataPath);
    }
}