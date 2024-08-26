import net from 'node:net'
import os from 'node:os'
import BinaryNumberFormatter from '../../utils/BinaryNumberFormatter';
export default class LocalFTPFinder{
    constructor(private timeout?:number){}
    async findLocalServers(port?:number,stopAtFirst?:boolean){
        //console.log(this.getCidrMap())
        const wifiCidr= this.getWifiInterfaceCidr();
        if(!wifiCidr){
            throw new Error("No wifi interface found, cannot perform ftp discovery scan")
        }

        //console.log(wifiCidr)
        const binNetworkIp= this.getNetworkIpAsBin(wifiCidr)
        const prefixL= this.getPrefixLengthFromCidr(wifiCidr)
        const hostL= 32-prefixL;
        //console.log(binNetworkIp)

        const splitNetIp= binNetworkIp.slice(0,prefixL)
        //console.log(splitNetIp)

        const totalHosts= Math.pow(2,hostL);
        console.log("Scanning "+totalHosts+" hosts in network: "+this.bin2ip(binNetworkIp))
        const aliveHosts:string[]=[];
        const ftpPort:number= port||21;
        let percentage=0;
        let count=0;
        for(let i=0; i<totalHosts;i++){
            const binaryHostNumber= BinaryNumberFormatter.dec2binUnsigned(i,hostL)
            const binaryHostIp= splitNetIp+binaryHostNumber;
            const hostIp= this.bin2ip(binaryHostIp)
            //console.log("Checking host: "+hostIp)
            const alive= await this.checkPort(hostIp,ftpPort);
            if(alive) {
                aliveHosts.push(hostIp);
                if(aliveHosts.length==1 && stopAtFirst) break;
            }
            
            if(count>=Math.round(totalHosts/5)){
                count=0;
                percentage= i/(totalHosts-1)
                console.log(`checked ${(i+1)}/${totalHosts} hosts (${(percentage*100).toFixed(3)}%)`)
            }else count++;
        }
        return aliveHosts;
    }

    getNetworkIpAsBin(cidr:string){
        const binaryIp= this.ip2bin(cidr);
        const mask= this.createSubnetMaskFromCidr(cidr);
        const networkIp= binaryIp.split("").map((binaryDigit:string,index:number)=>{
            const maskBinDigit:string= mask.charAt(index);
            if(
                binaryDigit=="1" &&
                maskBinDigit=="1"
            ) return "1"
            return "0"
        }).join("");
        return networkIp;
    }

    createSubnetMaskFromCidr(cidr:string){
        const prefixLength:number= this.getPrefixLengthFromCidr(cidr);
        //const hostLength:number= 32-prefixLength;
        let mask="";
        for(let i=0; i<32; i++){
            mask=mask+(i<prefixLength?"1":"0");
        }
        return mask;
    }

    getPrefixLengthFromCidr(cidr:string){
        if(!cidr.includes("/")) throw new Error("invalid cidr address, missing prefix length: "+cidr)
        return parseInt(cidr.split("/")[1]);
    }

    bin2ip(binAddr:string){
        let ipAddrNumbers:string[]=[];
        for(let i=0; i<4;i++){
            const slice= binAddr.slice(i*8, (i*8)+8)
            //console.log(slice)
            const number= BinaryNumberFormatter.bin2decUnsigned(slice)
            ipAddrNumbers.push(number.toString())
        }
        return ipAddrNumbers.join(".")
    }

    ip2bin(addr:string):string{
        let _addr="";
        let binAddr="";
        if(addr.includes("/")){
            _addr= addr.split("/")[0]
        }else{
            _addr=addr;
        }
        const numArr= _addr.split(".");
        for(const decString of numArr){
            binAddr=binAddr+BinaryNumberFormatter.dec2binUnsigned(parseInt(decString),8);
        }
        return binAddr;
    }

    getWifiInterfaceCidr():string|null{
        const map=this.getCidrMap();
        let wifiCidr:string|null= null;
        const wifiInterfaceNameRegex= new RegExp(/wi.fi/);
        for(const key of map.keys()){
            const interfaceName= key.toLowerCase();
            if(wifiInterfaceNameRegex.test(interfaceName)){
                wifiCidr= map.get(key) as string;
                break;
            }
        }
        return wifiCidr;
    }

    getCidrMap() {
        const netInterfaces = os.networkInterfaces();
        let map= new Map<string,string>();
        for(const interfaceName in netInterfaces){
            //console.log(interfaceName)
            const interfaceInfo = netInterfaces[interfaceName] as os.NetworkInterfaceInfo[];
            for(const alias of interfaceInfo){
                if(alias.family=="IPv4"){
                    map.set(interfaceName,alias.cidr||"")
                }
            }
            //console.log(interfaceInfo)
        }
        return map;
    }

    checkPort(host:string, port:number) {
        return new Promise(resolve=>{
            const socket = new net.Socket();
            const timeOut= this.timeout||100;
            socket.setTimeout(timeOut); // 100 milli seconds timeout
            
            socket.on('connect', () => {
                console.log(`${host}:${port} is open`);
                socket.destroy();
                resolve(true)
            });
        
            socket.on('timeout', () => {
                //console.log(`${host}:${port} is not responding`);
                socket.destroy();
                resolve(false)
            });
        
            socket.on('error', (err) => {
                //console.log(`${host}:${port} is closed`);
                resolve(false)
            });
        
            socket.connect(port, host);
        })
    }
}