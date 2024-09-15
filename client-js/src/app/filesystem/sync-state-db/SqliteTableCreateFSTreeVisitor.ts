import { DirectoryNode, FileNode } from "../../../lib/filesystem-tree-visitor/FileSystemNode";
import { FileSystemVisitor } from "../../../lib/filesystem-tree-visitor/FileSystemVisitor.interface";
import { SqliteDriver } from "../../../lib/SqliteDriver";

const tableName="filesystem"
export default class SqliteTableCreateFSTreeVisitor implements FileSystemVisitor{
    private currParentId=1;
    private currIndex=1;
    constructor(private db:SqliteDriver){}
    async visitFile(file: FileNode): Promise<void> {
        this.db.addRow(tableName,{
            id: this.currIndex,
            parent_id: this.currParentId,
            path: file.path,
            name: file.name,
            size: file.data.size,
            mtime: file.data.mtime,
            is_directory: false,
            checksum: file.data.checksum,
        });
        this.currIndex++;
    }
    async visitDirectory(directory: DirectoryNode): Promise<void> {
        if(directory.name==""){
            //ROOT
            this.db.addRow(tableName,{
                id: this.currIndex,
                parent_id: null,
                path: directory.path,
                name: null,
                size: 0,
                mtime: null,
                is_directory: true,
                checksum: null,
            });
        }else{
            //ADD DIR
            this.db.addRow(tableName,{
                id: this.currIndex,
                parent_id: this.currParentId,
                path: directory.path,
                name: directory.name,
                size: 0,
                mtime: directory.data.mtime,
                is_directory: true,
                checksum: null,
            });
        }

        const oldParentId= this.currParentId;
        this.currParentId= this.currIndex;
        this.currIndex++;//always increment
        for(const fsNode of directory.getChildren().values()){
            await fsNode.accept(this)
        }
        this.currParentId=oldParentId;
    }
}