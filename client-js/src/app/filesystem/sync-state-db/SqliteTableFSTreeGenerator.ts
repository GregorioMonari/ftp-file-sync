import BaseFSTreeGenerator from "../../../lib/filesystem-tree-visitor/BaseFSTreeGenerator";
import { FSEntry } from "../../../lib/filesystem-tree-visitor/fs-entry.interface";
import { SqliteDriver } from "../../../lib/SqliteDriver";

export default class SqliteTableFSTreeGenerator extends BaseFSTreeGenerator{
    constructor(private db:SqliteDriver){
        super();
    }
    protected async list(dirPath:string): Promise<FSEntry[]>{
        const dirRecords= await this.db.queryData("filesystem",["id"],"path='"+dirPath+"'")
        const parentId= dirRecords[0].id;
        const entries= await this.db.queryData("filesystem",["path","name","size","mtime","is_directory","checksum"],"parent_id='"+parentId+"'");
        const parsedEntries:FSEntry[]=[];
        for(const entry of entries){
            const data:FSEntry= {
                name: entry.name as string,
                size: entry.size as number || 0,
                mtime: new Date(entry.mtime as number),
                isDirectory: (entry.is_directory as number)==1?true:false,
            } 
            if(!entry.is_directory) data.checksum= entry.checksum as string;
            parsedEntries.push(data);
        }
        return parsedEntries
    }
}