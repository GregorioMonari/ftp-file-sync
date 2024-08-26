import path from "path";
import { FSEntry } from "./fs-entry.interface";
import { DirectoryNode, FileNode } from "./FileSystemNode";


export default abstract class BaseFSTreeGenerator{

    private currDirNode!:DirectoryNode;

    //TO OVERRIDE
    protected async list(dirPath:string): Promise<FSEntry[]> {
        return []
    }

    public async generateFSTreeFromPath(dir:string): Promise<DirectoryNode>{
        const root= new DirectoryNode("",dir,{name:"",size:0,mtime:new Date(),isDirectory:true}) //root is empty
        this.currDirNode= root;
        await this.visit(dir);
        return this.currDirNode;
    }

    private async visit(parentDir:string){
        //console.log("**Visiting directory: "+parentDir)
        //console.log("Current node:",this.currDirNode)
        const entries:FSEntry[]= await this.list(parentDir);
        for(const entry of entries){
            const entryPath= path.join(parentDir,entry.name);
            //Recursively call this function if entry is a directory
            if(entry.isDirectory){
                const newDirNode= new DirectoryNode(entry.name,entryPath,entry);
                //console.log("Adding directory node:",newDirNode)
                this.currDirNode.add(entry.name,newDirNode);

                const oldDirNode= this.currDirNode; //save curr dir node for later
                this.currDirNode= newDirNode;

                
                await this.visit(entryPath)

                this.currDirNode= oldDirNode; //restore old node
            }else{
                //Add file to childrens of currDirNode
                const newNode= new FileNode(entry.name,entryPath,entry);
                //console.log("Adding file node:",newNode," to node:",this.currDirNode)
                this.currDirNode.add(entry.name,newNode)
            }
        }
    }
}