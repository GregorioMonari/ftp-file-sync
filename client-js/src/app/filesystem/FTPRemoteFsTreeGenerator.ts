import BaseFSTreeGenerator from "../../lib/filesystem-tree-visitor/BaseFSTreeGenerator";
import { FSEntry } from "../../lib/filesystem-tree-visitor/fs-entry.interface";
import parseUNIXLsDate from "../../utils/unix-date-parser";
import FileTransferClient from "../FileTransferClient";

export default class FTPRemoteFsTreeGenerator extends BaseFSTreeGenerator{
    constructor(private client:FileTransferClient){
        super();
    }

    protected async list(dirPath:string): Promise<FSEntry[]>{
        const entries= await this.client.list(dirPath);
        //console.log(entries)
        return entries.map(entry=>{

            return {
                name: entry.name,
                size: entry.size,
                mtime: parseUNIXLsDate(entry.rawModifiedAt),
                isDirectory: (entry.type==2),
            }
        })
    }
}