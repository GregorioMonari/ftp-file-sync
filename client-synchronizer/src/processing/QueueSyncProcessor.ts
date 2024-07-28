import EventsQueue from "./EventsQueue";

export default class QueueSyncProcessor{
    public watcherQueue:EventsQueue;
    public wsQueue:EventsQueue;
    constructor(target:any){
        this.watcherQueue= new EventsQueue(target,"onWatcherQueueNotification")
        this.wsQueue= new EventsQueue(target,"onWsQueueNotification")
    }
}