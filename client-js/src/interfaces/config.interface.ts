export interface Config{
    host:string;
    port?:number;
    user:string;
    password:string;
    
    timeout?:number;
    secure?:boolean;
    verbose?:boolean;

    subscribe?:boolean;
    wsPort?:number;
    
    pathToWatch:string;
}