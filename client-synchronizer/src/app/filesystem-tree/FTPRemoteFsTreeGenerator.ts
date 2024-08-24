import BaseFSTreeGenerator from "./base/BaseFSTreeGenerator";
import { FSEntry } from "../../interfaces/fs-entry.interface";
import * as fs from "fs";
import path from "path";
import * as ftp from "basic-ftp";
import parseUNIXLsDate from "../../utils/unix-date-parser";

export default class FTPRemoteFsTreeGenerator extends BaseFSTreeGenerator{
    constructor(private client:ftp.Client){
        super();
    }

    protected async list(dirPath:string): Promise<FSEntry[]>{
        const entries= await this.client.list(dirPath);
        console.log(entries)
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