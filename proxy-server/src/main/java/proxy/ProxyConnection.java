package proxy;

import proxy.utils.Transaction;

import java.net.*;
public class ProxyConnection {
    public ProxyConnection(Socket clientSocket, Socket ftpSocket){
        boolean printTraffic=true;
        Transaction transaction= new Transaction();
        new Thread(new SocketIOHandler(SocketHandlerTypes.CLIENT_HANDLER,clientSocket,ftpSocket,this,transaction,printTraffic)).start();
        new Thread(new SocketIOHandler(SocketHandlerTypes.SERVER_HANDLER,ftpSocket,clientSocket,this,transaction,printTraffic)).start();
    }

    public void onBeforeTransactionCommand(String command, Transaction transaction){
        //System.out.println("On transaction command: "+command);
    }
    public void onBeforeTransactionResponse(String response, Transaction transaction){
        //System.out.println("On transaction response: "+response);
    }
}
