import { QueueEvent } from "../../../interfaces/queue-event.interface";

//Execute in chain
export default class EventsQueue{
    private maxSize=100;
    private target:any;
    private callBack:any;
    private parent:any;

    public type:"watcher"|"websocket"
    public queue:QueueEvent[]=[];
    public isProcessing:boolean=false;
    public requiresProcessing:boolean=false;

    constructor(target:any,callBackName:string,parent:any,type:"watcher"|"websocket"){
        this.target=target;
        this.callBack=callBackName;
        this.parent=parent;
        this.type=type;
    }
    add(event:QueueEvent){
        if(this.queue.length>=this.maxSize){
            console.log("event queue is full! cannot send event:",event)
            return;
        }
        this.queue.push(event)
        this.requiresProcessing=true;
    }

    
    async processQueue(){
        if(this.queue.length==0) {
            this.onQueueProcessingEnd();
            return;
        }; //stop if empty
        this.isProcessing=true;
        this.requiresProcessing=false;


        //get first element of array
        const event= this.queue[0];
        //process event
        try{
            await this.target[this.callBack](event);
        }catch(e){
            console.error(e); //go on
        }
        //pop first element
        this.queue.shift();
        //Call this function recursively until queue is empty
        this.processQueue();
    }

    onQueueProcessingEnd(){
        this.isProcessing=false;
        let other;
        
        if(this.type=="watcher"){
            other= this.parent.wsQueue;
        }else{
            other= this.parent.watcherQueue;
        }

        if(other.requiresProcessing){
            other.processQueue();
        }
    }
}