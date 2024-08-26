import BaseFSTreeGenerator from "../../lib/filesystem-tree-visitor/BaseFSTreeGenerator";
import { FSEntry } from "../../lib/filesystem-tree-visitor/fs-entry.interface";
import * as fs from "fs";
import path from "path";

export default class LocalFSTreeGenerator extends BaseFSTreeGenerator{
    protected async list(dirPath:string): Promise<FSEntry[]>{
        const entries= fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(entry=>{
            //console.log("Reading entry: "+entry.name)
            const entryPath= path.join(dirPath,entry.name);
            const stats= fs.statSync(entryPath);
            stats.mtime.setSeconds(0,0)
            //console.log(stats.mtime)
            return {
                name: entry.name,
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: entry.isDirectory(),
            } 
        })
    }
}