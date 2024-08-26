export interface Config{
    pathToWatch:string;

    host:string;
    port?:number;
    wsPort?:number;
    user:string;
    password:string;
    
    timeout?:number;
    secure?:boolean;
    
    subscribe?:boolean;
    autoConnect?:boolean;
    verbose?:boolean;
}