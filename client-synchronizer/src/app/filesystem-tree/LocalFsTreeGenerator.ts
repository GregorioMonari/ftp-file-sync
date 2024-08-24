import BaseFSTreeGenerator from "./base/BaseFSTreeGenerator";
import { FSEntry } from "../../interfaces/fs-entry.interface";
import * as fs from "fs";
import path from "path";

export default class LocalFSTreeGenerator extends BaseFSTreeGenerator{
    protected async list(dirPath:string): Promise<FSEntry[]>{
        const entries= fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(entry=>{
            //console.log("Reading entry: "+entry.name)
            const entryPath= path.join(dirPath,entry.name);
            const stats= fs.statSync(entryPath);
            return {
                name: entry.name,
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: entry.isDirectory(),
            } 
        })
    }
}