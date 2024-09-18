import SyncStateDb from "./SyncStateDb";
import { FileSystemNode,DirectoryNode } from "../../../lib/filesystem-tree-visitor/FileSystemNode";
import { FSNodeJson } from "../../../lib/filesystem-tree-visitor/serialization-base/fs-node-json.interface";
import { fst_deserialize, fst_serialize } from "../../../lib/filesystem-tree-visitor/serialization";
import * as fs from "fs";
import path from "path";
import { getLocalFileChecksum, getStringChecksum } from "../../checksum-utils";
import { SqliteDriver } from "../../../lib/SqliteDriver";
import SqliteTableCreateFSTreeVisitor from "./SqliteTableCreateFSTreeVisitor";
import SqliteTableFSTreeGenerator from "./SqliteTableFSTreeGenerator";

const tableName="filesystem"

export default class SqliteSyncStateDb extends SyncStateDb{
    private sqliteDb:SqliteDriver;
    private dbFilePath:string;
    private firstFreeRecordIndex!:number;
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
        if(!await this.sqliteDb.tableExists(tableName)) return null;
        if(await this.sqliteDb.tableIsEmpty(tableName)) return null;
        //GET ROOT PATH
        const rootRecord= await this.sqliteDb.queryData(tableName,["path"],"id=1");
        const rootPath= rootRecord[0].path as string;
        console.log("Sync db rootPath: "+rootPath)
        const generator= new SqliteTableFSTreeGenerator(this.sqliteDb);
        const tree= await generator.generateFSTreeFromPath(rootPath);
        const res=await this.sqliteDb.queryData(tableName,["id"],"id = (SELECT MAX(id) FROM "+tableName+")");
        this.firstFreeRecordIndex= (res[0].id as number)+1;
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

    //TODO: UPDATE DIRECTORIES AND ALL THEIR CONTENT RECURSIVELY
    async update(path:string){
        //console.log("Updating: "+path)
        //Get fs entry
        const stat= fs.statSync(path);
        const isDir= stat.isDirectory();
        let checksum= null;
        if(!isDir) checksum= await getLocalFileChecksum(path) //get checksum only for files
        //Get parent id
        let parentId= await this.getEntryParentIdByPath(path) //-9999;
        if(!parentId) {
            console.log("adding orphan entry: "+path)
            parentId= -9999;
        }
        //Get current entry id
        let recordId= await this.getEntryIdByPath(path)
        if(recordId){ //Already exists
            //First, remove
            await this.remove(path);
            //Then, add record with same id
            await this.sqliteDb.addRow(tableName,{            
                id: recordId,
                parent_id: parentId,
                path: path,
                name: this.getNameFromPath(path),
                size: stat.size||0,
                mtime: stat.mtime,
                is_directory: isDir,
                checksum
            }); 
        }else{
            recordId= this.generateFreshId()
            //Add new record with fresh id
            await this.sqliteDb.addRow(tableName,{            
                id: recordId,
                parent_id: parentId,
                path: path,
                name: this.getNameFromPath(path),
                size: stat.size||0,
                mtime: stat.mtime,
                is_directory: isDir,
                checksum
            }); 
        }

        //TODO: Check if orphans algorithm works, it is random when it occurs
        if(stat.isDirectory()){
            //If it is a directory, check if there are any records without parent, and update them if necessary
            const orphans=await this.sqliteDb.queryData(tableName,["*"],"id==-9999")
            if(orphans.length==0) return;
            console.log("Checking "+orphans.length+" orphans for dir: "+path)
            for(const orphan of orphans){
                if((orphan.path as string).startsWith(path)){
                    console.log("Resolving orphan: "+orphan.path)
                    //*Allora è sicuramente figlio di questa directory
                    //First, remove orphan
                    await this.remove(path);
                    //Then, add record with same id
                    await this.sqliteDb.addRow(tableName,{            
                        id: orphan.id,
                        parent_id: recordId, //add the id of this directory as parent
                        path: orphan.path,
                        name: orphan.name,
                        size: orphan.size,
                        mtime: orphan.mtime,
                        is_directory: orphan.is_directory,
                        checksum: orphan.checksum
                    }); 
                }
            }
        }
    }
    private generateFreshId(){
        let currID=this.firstFreeRecordIndex;  //await this.getEntryIdByPath(path)  //-9999;
        this.firstFreeRecordIndex++;
        return currID;
    }
    private async getEntryIdByPath(path:string):Promise<number|null>{
        const res=await this.sqliteDb.queryData(tableName,["id"],"path=='"+path+"'");
        if(res.length==0) return null;
        return res[0].id as number;
    }
    private async getEntryParentIdByPath(path:string):Promise<number|null>{
        let parentDirPath="";
        const separator= path.includes("\\")?"\\":"/"
        const pathArr= path.split(separator)
        parentDirPath=pathArr.slice(0,pathArr.length-1).join(separator)
        const res=await this.sqliteDb.queryData(tableName,["id"],"path=='"+parentDirPath+"'")
        if(res.length==0) return null;
        return res[0].id as number
    }
    private getNameFromPath(path:string){
        const separator= path.includes("\\")?"\\":"/"
        const pathArr= path.split(separator)
        return pathArr[pathArr.length-1]
    }

    //TODO: IF DIRECTORY, REMOVE ALL CHILDREN RECURSIVELY
    async remove(path:string){
        await this.sqliteDb.deleteRow(tableName,"path=='"+path+"'",[]);
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