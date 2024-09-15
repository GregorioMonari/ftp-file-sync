import * as fs from 'fs';
import * as crypto from 'crypto';
import * as ftp from 'basic-ftp'; // Using basic-ftp library for FTP connections
import {Writable} from 'stream';

export function getStringChecksum(string:string): string{
    const hash = crypto.createHash('md5');
    hash.update(string)
    return hash.digest('hex')
}

export async function getLocalFileChecksum(filePath:string): Promise<string>{
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}