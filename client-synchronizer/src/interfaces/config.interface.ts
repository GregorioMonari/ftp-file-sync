export interface Config{
    host:string;
    port?:number;
    wsPort?:number;
    user:string;
    password:string;
    
    timeout?:number;
    secure?:boolean;
    verbose?:boolean;

    pathToWatch:string;
}