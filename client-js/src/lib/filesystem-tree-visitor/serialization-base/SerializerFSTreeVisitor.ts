import { FSNodeJson } from "./fs-node-json.interface";
import { DirectoryNode, FileNode } from "../FileSystemNode";
import { FileSystemVisitor } from "../FileSystemVisitor.interface";

export default class SerializerFSTreeVisitor implements FileSystemVisitor{
    
    private fsTreeJson:FSNodeJson;
    private currJsonObjDirRef:FSNodeJson;

    constructor(){
        const jsonFsObj:FSNodeJson= {
            name: "",
            path: "",
            data: {
                name: "",
                size: 0,
                mtime: new Date(),
                isDirectory: true,
            },
            children: {}
        };
        this.fsTreeJson= jsonFsObj;
        this.currJsonObjDirRef= jsonFsObj;
    }

    getTreeJson(){
        return this.fsTreeJson;
    }

    async visitFile(file: FileNode): Promise<void> {
        if(this.currJsonObjDirRef.children){
            this.currJsonObjDirRef.children[file.name]= {
                name: file.name,
                path: file.path,
                data: file.data
            };
        }
    }
    
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        let oldJsonObjRef= this.currJsonObjDirRef;
        if(directory.name!=""){
            if(this.currJsonObjDirRef.children){
                this.currJsonObjDirRef.children[directory.name]={
                    name: directory.name,
                    path: directory.path,
                    data: directory.data,
                    children: {}
                };
                this.currJsonObjDirRef= this.currJsonObjDirRef.children[directory.name];
            }
        }else{
            //todo: Manage root dir
            this.currJsonObjDirRef.path= directory.path;
        }
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
        if(directory.name!=""){
            this.currJsonObjDirRef= oldJsonObjRef;
        }
    }
}