export interface FSEntry{
    name:string;
    size:number;
    mtime: Date;
    isDirectory: boolean;
    checksum?:string;
}