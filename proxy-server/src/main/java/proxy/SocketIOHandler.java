package proxy;

import proxy.utils.Transaction;

import java.io.*;
import java.net.Socket;



public class SocketIOHandler implements Runnable{
    ProxyConnection parentConnection;
    Transaction currentTransaction;
    SocketHandlerTypes type;
    Socket socketIN;
    Socket socketOUT;
    boolean printTraffic;
    public SocketIOHandler(SocketHandlerTypes type, Socket socketIN, Socket socketOUT, ProxyConnection parentConnection, Transaction transaction){
        this.parentConnection=parentConnection;
        this.currentTransaction= transaction;
        this.type=type;
        this.socketIN= socketIN;
        this.socketOUT= socketOUT;
        this.printTraffic=true;
    }

    public SocketIOHandler(SocketHandlerTypes type, Socket socketIN, Socket socketOUT, ProxyConnection parentConnection, Transaction transaction,
                           boolean printTraffic){
        this.parentConnection=parentConnection;
        this.currentTransaction= transaction;
        this.type=type;
        this.socketIN= socketIN;
        this.socketOUT= socketOUT;
        this.printTraffic=printTraffic;
    }

    public void run(){
        try {

            InputStream streamIN = socketIN.getInputStream();
            OutputStream streamOUT = socketOUT.getOutputStream();
            //Buffers
            BufferedReader bufferIN = new BufferedReader(new InputStreamReader(streamIN));
            BufferedWriter bufferOUT = new BufferedWriter(new OutputStreamWriter(streamOUT));
            //Expose buffers to proxyConnection
            if(type==SocketHandlerTypes.CLIENT_HANDLER){
                parentConnection.clientBufferIn=bufferIN;
            }else{
                parentConnection.clientBufferOut=bufferOUT;
            }

            String payload;
            while(true){
                if(bufferIN.ready()){ //bufferin full
                    payload = bufferIN.readLine();
                    if(payload != null) {
                        //Call processor before forwarding the package
                        try{
                            if(printTraffic) printPayload(payload);
                            if(type==SocketHandlerTypes.CLIENT_HANDLER){
                                //System.out.println("client >: "+payload);
                                currentTransaction.addCommand(payload);
                                parentConnection.onBeforeTransactionCommand(payload,currentTransaction);
                            }else{
                                //System.out.println("server <: "+payload);
                                currentTransaction.addResponse(payload);
                                parentConnection.onBeforeTransactionResponse(payload,currentTransaction); //emit always
                            }
                        }catch(RuntimeException e){
                            e.printStackTrace();
                            System.out.println("onTransaction event execution encountered an error, but the standard Ftp flow was left untouched. Moving on");
                        }

                        //Forward payload to other socket
                        if(currentTransaction.canPassThrough()){
                            bufferOUT.write(payload + "\r\n");
                            bufferOUT.flush();
                        }else{
                            System.out.println("Passthrough is disabled for this transaction, skipping forwarding");
                            //Restore passthrough for any following response
                            currentTransaction.setPassThrough(true);
                        }
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void printPayload(String payload){
        String arrow;
        if( type==SocketHandlerTypes.CLIENT_HANDLER ){
            arrow=">";
        }else{
            arrow="<";
        }
        System.out.println("("+parentConnection.toString()+") "+arrow+" "+payload);
    }
}