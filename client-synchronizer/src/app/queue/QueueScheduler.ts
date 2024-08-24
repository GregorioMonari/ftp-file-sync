import { QueueEvent } from "../../interfaces/queue-event.interface";
import EventsQueue from "./EventsQueue";

export default class QueueScheduler{
    public watcherQueue:EventsQueue;
    public wsQueue:EventsQueue;
    public previousServerCommandsBuffer:string[]=[]; //Used for renames which need 2 commands in order to function
    constructor(target:any){
        this.watcherQueue= new EventsQueue(target,"onWatcherQueueNotification",this,"watcher")
        this.wsQueue= new EventsQueue(target,"onWsQueueNotification",this,"websocket")
    }

    async add(event:QueueEvent){
        let targetQueue:EventsQueue;
        let otherQueue:EventsQueue;

        if(event.type=="watcher"){
            targetQueue= this.watcherQueue
            otherQueue= this.wsQueue
        }else{
            targetQueue= this.wsQueue
            otherQueue= this.watcherQueue
        }

        targetQueue.add(event);
        if(!targetQueue.isProcessing){
            if(!otherQueue.isProcessing){
                targetQueue.processQueue(); //At the end it will call the other queue processQueue if requiresProcessing=true
                //After this queue has finished processing, it has requiresProcessing=false;
            }else{
                //If other queue is processing, do not start but notify that queue is not empty
                //At the end of the other processing, check if this requires processing is true, and start the next processing
                //!WARNING: THIS COULD CAUSE DEADLOCK: if the first processing never ends, the other processing will never start.
                //TODO: But this should not happen because you are supposed to write from 1 single device at a time. Open for future improvements
                targetQueue.requiresProcessing=true;
            }
        }
    }

    //Add new event
    //Processing starts, await for it to finish all the chain
    //Log "chain processing finished"

    //When a new ws notification comes, the add function is called again.
    //If there is a currently processing chain, stop it

    //When the chain stops, it is it that calls the other queue chain and starts it;
    //But this is a naive scheduler

    //Ws messages history should be saved in a pile, and cancelled when
}