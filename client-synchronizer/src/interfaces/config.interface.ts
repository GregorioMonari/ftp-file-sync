export interface Config{
    host:string;
    user:string;
    password:string;
    
    timeout?:number;
    secure?:boolean;
    verbose?:boolean;

    pathToWatch:string;
}