import BaseFSTreeGenerator from "../BaseFSTreeGenerator";
import { DirectoryNode } from "../FileSystemNode";
import { FSEntry } from "../fs-entry.interface";
import { FSNodeJson } from "./fs-node-json.interface";

export default class DeserializerFSTreeGenerator extends BaseFSTreeGenerator{

    private jsonFSTree!:FSNodeJson;
    private jsonFSTreeRootPath!:string;

    public async generateFSTreeFromPath(dir:string): Promise<DirectoryNode>{
        throw new Error("Not implemented in this class, use generate from json instead");
    }

    public async generateFSTreeFromJson(json:FSNodeJson){
        this.jsonFSTree= json;
        this.jsonFSTreeRootPath= this.jsonFSTree.path;
        const root= new DirectoryNode("",this.jsonFSTreeRootPath,{name:"",size:0,mtime:new Date(),isDirectory:true}) //root is empty
        this.currDirNode= root;
        await this.visit(this.jsonFSTreeRootPath);
        return this.currDirNode;
    }

    protected async list(dirPath:string): Promise<FSEntry[]>{
        const dirJsonObj= this.getJsonFSTreeObjFromPath(dirPath);
        const entries= dirJsonObj.children;
        if(entries){
            return Object.keys(entries).map(entryName=>{
                const entry= entries[entryName];
                //console.log("Reading entry: "+entry.name)
                return entry.data;
            })
        }else
            return []
    }

    private getJsonFSTreeObjFromPath(dirPath:string){
        //Manage root path
        if(dirPath == this.jsonFSTreeRootPath){
            return this.jsonFSTree;
        }

        let relativePath= dirPath.replace(this.jsonFSTreeRootPath,"");
        let separator=relativePath.includes("\\")?"\\":"/"; //default
        if(relativePath.startsWith(separator)){
            relativePath= relativePath.slice(1);
        }
        const pathArr= relativePath.split(separator);
        //console.log(pathArr)
        let currObjRef= this.jsonFSTree;
        for(const name of pathArr){
            //console.log("Reading "+name+" from "+currObjRef.path)
            if(currObjRef.children){
                currObjRef= currObjRef.children[name]; //enter directory in next loop
            }
        } 
        return currObjRef;
    }
}