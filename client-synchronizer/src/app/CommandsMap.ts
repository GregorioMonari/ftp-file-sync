export default class CommandsMap{
    public static event2commandName:{[key:string]:string}={
        "change": "STOR",
        "add": "STOR",
        "addDir": "MKD",
        "unlink": "DELE",
        "unlinkDir": "RMD"
    }
}