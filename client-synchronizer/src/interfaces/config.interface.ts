export interface Config{
    host:string;
    port?:number;
    user:string;
    password:string;
    
    timeout?:number;
    secure?:boolean;
    verbose?:boolean;

    pathToWatch:string;
}