export interface QueueEvent{
    type: "watcher"|"websocket";
    data: {
        [key:string]: string|null;
    }
}