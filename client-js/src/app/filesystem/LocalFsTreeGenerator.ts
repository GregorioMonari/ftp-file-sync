import BaseFSTreeGenerator from "../../lib/filesystem-tree-visitor/BaseFSTreeGenerator";
import { FSEntry } from "../../lib/filesystem-tree-visitor/fs-entry.interface";
import * as fs from "fs";
import path, { parse } from "path";
import { getLocalFileChecksum } from "../checksum-utils";
import { DirectoryNode } from "../../lib/filesystem-tree-visitor/FileSystemNode";

export default class LocalFSTreeGenerator extends BaseFSTreeGenerator{
    private includeAllChecksums:boolean=false;
    async generateFSTreeFromPath(dir: string,includeAllChecksums?:boolean): Promise<DirectoryNode> {
        this.includeAllChecksums=includeAllChecksums||false;
        return super.generateFSTreeFromPath(dir);
    }
    protected async list(dirPath:string): Promise<FSEntry[]>{
        const entries= fs.readdirSync(dirPath, { withFileTypes: true });
        let parsedEntries:FSEntry[]=[];
        for(const entry of entries){
            //console.log("Reading entry: "+entry.name)
            const entryPath= path.join(dirPath,entry.name);
            const stats= fs.statSync(entryPath);
            stats.mtime.setSeconds(0,0)
            //console.log(stats.mtime)
            const data:FSEntry= {
                name: entry.name,
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: entry.isDirectory(),
            } 
            if(this.includeAllChecksums){
                if(!data.isDirectory)
                    data.checksum=await getLocalFileChecksum(entryPath)
            }
            parsedEntries.push(data);
        }
        return parsedEntries;
    }
}