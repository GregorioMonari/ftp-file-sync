import { FileSystemNode } from "./FileSystemNode";
import DeserializerFSTreeGenerator from "./serialization-base/DeserializerFSTreeGenerator";
import { FSNodeJson } from "./serialization-base/fs-node-json.interface";
import SerializerFSTreeVisitor from "./serialization-base/SerializerFSTreeVisitor";


export async function fst_serialize(tree:FileSystemNode){
    const serializerVisitor= new SerializerFSTreeVisitor();
    await tree.accept(serializerVisitor);
    return serializerVisitor.getTreeJson();
}

export async function fst_deserialize(jsonTree:FSNodeJson){
    const deserializerGenerator= new DeserializerFSTreeGenerator();
    const deserializedTree= await deserializerGenerator.generateFSTreeFromJson(jsonTree);
    return deserializedTree;
}