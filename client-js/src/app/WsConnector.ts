import { Config } from "../interfaces/config.interface";
import * as ftp from "basic-ftp";
import WebSocket, {MessageEvent} from "ws";
import FileTransferClient from "./FileTransferClient";
/*
WS-FTP LINK PROTOCOL
client uses the original ftp socket
client sends ftp command: PROXYCONNID
proxy responds with: 200 YOUR-ID
client opens ws socket
client sends ws message: YOUR-ID
proxy responds with: ok
client can now listen to ws events
*/
export default class WsConnector{
    private config:Config;
    private client:FileTransferClient; //handle file upload/download

    constructor(config:Config,client:FileTransferClient){
        this.config=config;
        this.client=client;
    }

    async getProxyConnID(): Promise<string>{
        const response= await this.client.sendMessage("PROXYCONNID")
        console.log("Received connection id: ",response)
        if(response.code!=200){
            throw new Error("Error while subscribing to ws proxy: "+response.message)
        }
        return response.message.split(" ")[1];
    }

    //0. Get conn ID from proxy server
    //1. Add data listener
    //2. Send conn ID
    //3. On "ok" response, resolve
    async subscribe(): Promise<WebSocket>{
        const proxyConnID= await this.getProxyConnID();
        return new Promise(resolve=>{
            //Open websocket
            const newWebSocket = new WebSocket(`ws://${this.config.host}:${this.config.wsPort||8085}`);
            newWebSocket.on("open", () => {
                console.log("Opened new ws socket");
                const onStreamEvent= (event: MessageEvent)=>{
                    if(event.data.toString().startsWith("ok")){
                        newWebSocket.removeEventListener("message",onStreamEvent)
                        console.log("ws linked successfully with proxy")
                        resolve(newWebSocket);
                    }
                }
                newWebSocket.addEventListener("message",onStreamEvent)
                newWebSocket.send(proxyConnID);
            });
        })
    }
}