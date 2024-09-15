import { FileSystemNode,DirectoryNode } from "../../../lib/filesystem-tree-visitor/FileSystemNode";
//One instance is connected to one db.
//Create a new instance to change db
export default abstract class SyncStateDb{
    constructor(protected appDataPath:string, protected dbName:string){}

    async recreateDbFromFSNode(data:DirectoryNode){
        throw new Error("Not implemented")
    }
    async getDbAsFSNode(): Promise<DirectoryNode|null>{
        throw new Error("Not implemented")
    }

    async closeDb(){
        throw new Error("Not implemented")
    }
    async add(path:string, data:FileSystemNode){
        throw new Error("Not implemented")
    }
    async update(path:string, data:FileSystemNode){
        throw new Error("Not implemented")
    }
    async remove(path:string){
        throw new Error("Not implemented")
    }
    async get(path:string): Promise<FileSystemNode|null>{
        throw new Error("Not implemented")
    }
}