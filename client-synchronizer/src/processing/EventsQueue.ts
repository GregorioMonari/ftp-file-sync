import { QueueEvent } from "../interfaces/queue-event.interface";

//Execute in chain
export default class EventsQueue{
    private maxSize=100;
    private queue:QueueEvent[]=[];
    private target:any;
    private callBack:any;
    constructor(target:any,callBackName:string){
        this.target=target;
        this.callBack=callBackName;
    }
    add(event:QueueEvent){
        if(this.queue.length>=this.maxSize){
            console.log("event queue is full! cannot send event:",event)
            return;
        }
        this.queue.push(event)
        if(this.queue.length==1) this.processQueue();
    }
    private async processQueue(){
        if(this.queue.length==0) return; //stop if empty
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
}