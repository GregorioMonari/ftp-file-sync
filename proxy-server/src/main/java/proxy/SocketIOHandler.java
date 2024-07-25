package proxy;

import java.io.*;
import java.net.Proxy;
import java.net.Socket;



class SocketIOHandler implements Runnable{
    ProxyConnection parentConnection;
    SocketHandlerTypes type;
    Socket socketIN;
    Socket socketOUT;
    public SocketIOHandler(SocketHandlerTypes type, Socket socketIN, Socket socketOUT, ProxyConnection parentConnection){
        this.parentConnection=parentConnection;
        this.type=type;
        this.socketIN= socketIN;
        this.socketOUT= socketOUT;
    }

    public void run(){
        try (
                InputStream streamIN = socketIN.getInputStream();
                OutputStream streamOUT = socketOUT.getOutputStream();
                //Buffers
                BufferedReader bufferIN = new BufferedReader(new InputStreamReader(streamIN));
                BufferedWriter bufferOUT = new BufferedWriter(new OutputStreamWriter(streamOUT));
        ) {
            String payload;
            while(true){
                if(bufferIN.ready()){ //bufferin full
                    payload = bufferIN.readLine();
                    if(payload != null) {
                        //Forward command to server
                        bufferOUT.write(payload + "\r\n");
                        bufferOUT.flush();
                        //Notify
                        if(type==SocketHandlerTypes.CLIENT_HANDLER){
                            System.out.println("Forwarded client payload: " + payload);
                            parentConnection.currentTransaction.addCommand(payload);
                            parentConnection.onTransactionCommand(payload);
                        }else{
                            System.out.println("Forwarded server payload: " + payload);
                            parentConnection.currentTransaction.addResponse(payload);
                            if(parentConnection.currentTransaction.getResponses().size()==1){
                                //First response
                                parentConnection.onTransactionFirstResponse(payload);
                            }else{
                                parentConnection.onTransactionMultipleResponse(payload);
                            }
                        }

                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}