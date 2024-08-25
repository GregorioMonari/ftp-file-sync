//Converts command line arguments into a more convenient json object
export interface ArgInfo{
    name: string;
    description?: string;
    type: 'positional'|'flag'|'arg';
}

export class MappingSchema{
    protected positionalArgs:ArgInfo[]=[];
    protected nonPositionalArgs:ArgInfo[]=[];

    addFlag(name:string,description?:string){
        this.nonPositionalArgs.push({
            name,
            description,
            type: 'flag'
        })
    }
    addArgument(name:string,description?:string){
        this.nonPositionalArgs.push({
            name,
            description,
            type: 'arg'
        })
    }
    addPositionalArgument(mapName:string,description?:string){
        this.positionalArgs.push({
            name: mapName,
            description,
            type: 'positional'
        })
    }
}


export default class CLIArgsMapper extends MappingSchema{

    public printFormattedHelp(notes?:string){
        console.log(this.getCommandStructure())
        console.log("")
        console.log("Arguments:")
        for(let i=0;i<this.positionalArgs.length;i++){
            console.log(`<${this.positionalArgs[i].name}>${(this.positionalArgs[i].description?": "+this.positionalArgs[i].description:"")}`)
        }
        //Then, check the other arguments
        console.log("")
        console.log("Options:")
        for(let i=0; i<this.nonPositionalArgs.length;i++){
            console.log(`${this.nonPositionalArgs[i].name}${(this.nonPositionalArgs[i].description?": "+this.nonPositionalArgs[i].description:"")}`)
        }
        if(notes) {
            console.log(" ")
            console.log(notes)
        }
    }

    private getCommandStructure(){
        let cmd="npm start --"
        for(let i=0;i<this.positionalArgs.length;i++){
            cmd=cmd+` <${this.positionalArgs[i].name}>`
        }
        if(this.nonPositionalArgs.length>0){
            cmd=cmd+" [options]"
        }
        return cmd;
    }


    public getArgsAsJson(){
        const list= this.getArgsAsList();
        //const firstCmd= list[0].toLocaleLowerCase(); //used to check if it is help or -help
        //if(firstCmd.includes("help")){
            //this.printHelp();
            //return;
        //}
        let out:{[key:string]:string|boolean|null}={};
        //First, check positional arguments
        for(let i=0;i<this.positionalArgs.length;i++){
            out[this.positionalArgs[i].name]= list[i];
        }
        //Then, check the other arguments
        for(let i=0; i<this.nonPositionalArgs.length;i++){
            const argInfo= this.nonPositionalArgs[i]
            const argIndex= list.indexOf(argInfo.name)
            const mappedArgName= argInfo.name.replace("-","");
            if(argIndex==-1) out[mappedArgName]= (argInfo.type=="flag"?false:null) //if argument is not present
            else out[mappedArgName]= (argInfo.type=="flag"?true:list[argIndex+1]) //if argument is present
        }
        return out;
    }

    public getArgsAsList():string[]{
        let args= process.argv.slice(2).map(value=>{
            let newValue= value.trim();
            //
            if(newValue.startsWith("\'") || newValue.startsWith("\"")){
                newValue=newValue.slice(1);
            }
            if(newValue.endsWith("\'") || newValue.endsWith("\"")){
                newValue=newValue.slice(0,newValue.length-1);
            }
            return newValue
        })
        return args
    }


}
