import { FSEntry } from "../fs-entry.interface";

export interface FSNodeJson{
    name: string;
    path: string;
    data: FSEntry;
    children?: {
        [key:string]: FSNodeJson;
    };
}