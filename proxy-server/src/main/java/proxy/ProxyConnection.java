package proxy;

import java.io.*;
import java.net.*;
public class ProxyConnection {
    public Transaction currentTransaction;
    public ProxyConnection(Socket clientSocket, Socket ftpSocket){
        currentTransaction= new Transaction();
        new Thread(new SocketIOHandler(SocketHandlerTypes.CLIENT_HANDLER,clientSocket,ftpSocket,this)).start();
        new Thread(new SocketIOHandler(SocketHandlerTypes.SERVER_HANDLER,ftpSocket,clientSocket,this)).start();
    }

    public void onTransactionCommand(String command){
        System.out.println("On transaction command: "+command);
    }
    public void onTransactionFirstResponse(String response){
        System.out.println("On transaction response: "+response);
    }
    public void onTransactionMultipleResponse(String response){
        System.out.println("On transaction multiple response: "+response);
    }

}
