import { FSEntry } from "../../../interfaces/fs-entry.interface";
import { FileSystemVisitor } from "./FileSystemVisitor.interface";

export abstract class FileSystemNode{
    constructor(
        public name: string, 
        public path: string,
        public data:FSEntry
    ) {}

    // Accept method that takes a visitor
    abstract accept(visitor: FileSystemVisitor): void;
}

export class FileNode extends FileSystemNode {
    constructor(name: string, path: string, data: FSEntry) {
      super(name,path,data);
    }
  
    // Implement the accept method
    accept(visitor: FileSystemVisitor): void {
      visitor.visitFile(this);
    }
}

export class DirectoryNode extends FileSystemNode {
    private children:  Map<string,FileSystemNode> = new Map();  //FileSystemNode[] = [];
  
    constructor(name: string, path:string, data: FSEntry) {
      super(name,path,data);
    }
  
    add(name:string, node: FileSystemNode): void {
      //this.children.push(node);
      this.children.set(name,node);
    }
  
    getChildren(): Map<string,FileSystemNode> {
      return this.children;
    }
  
    // Implement the accept method
    accept(visitor: FileSystemVisitor): void {
      visitor.visitDirectory(this);
    }
  }