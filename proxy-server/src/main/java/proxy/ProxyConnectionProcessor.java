package proxy;

import org.java_websocket.WebSocket;
import proxy.utils.*;

import java.io.*;
import java.net.Socket;
import java.util.List;

public class ProxyConnectionProcessor extends ProxyConnection{
    public String proxyConnID;
    public WebSocket linkedWebSocketConn;
    public boolean isLoggedIn=false;
    private String username;
    private String topLevelFolder=null; //first cwd that the user performs
    private String currentFolder;

    private final String[] commandsToIntercept= {"PROXYCONNID",   "STOR","USER","PASS","CWD","MKD","DELE","RMD"};
    private final List<ProxyConnectionProcessor> openedConnections;
    public ProxyConnectionProcessor(Socket clientSocket, Socket ftpSocket, List<ProxyConnectionProcessor> openedConnections, String proxyConnID){
        super(clientSocket, ftpSocket);
        this.openedConnections=openedConnections;
        this.proxyConnID=proxyConnID;
    }

    //HANDLE COMMANDS BEFORE THEY ARE EXECUTED BY THE SERVER
    @Override
    public void onBeforeTransactionCommand(String command, Transaction transaction){
        if(command == null) return;
        if(command.startsWith("PROXYCONNID")){
            transaction.setPassThrough(false);
            //Now the proxy responds instead of the ftp server
            try  {
                clientBufferOut.write("200 "+proxyConnID + "\r\n");
                clientBufferOut.flush();
            }catch(RuntimeException | IOException e){
                e.printStackTrace();
            }
            return;
        }
    }

    //HANDLE COMMANDS THAT WERE ALREADY EXECUTED BY THE SERVER
    //STOR prova2.txt -> 150 Ok to send data -> 226 Transfer complete
    //Called when bufferIN has been read, but bufferOUT still has not been written.
    //So when the client updates a file, it will not receive the response until the rerver responds AND all subscribers have been notified
    //This way we ensure that the client does not perform another operation before all clients are notified
    //TODO: you can consider sending the response before notifying to ensure scalability is maintained, but check concurrency first
    @Override
    public void onBeforeTransactionResponse(String response, Transaction transaction){
        //There are two cases where transactions can give problem: first and last server message
        //Handle the two cases separately
        if(transaction.getCommand()==null) return; //If command is null but there is a response, it is the server welcome message
        if(response.startsWith("421 Timeout.")){
            //Handle timeout
            System.out.println("** Handling timeout");
            return;
        }
        //Check if transaction needs to be intercepted and can be processed
        if(!assertTransactionRequiresInterceptAndIsValid(transaction)) return;

        //Process the transaction
        processTransaction(transaction);
    }

    //Processes required transactions and notify client if needed
    private void processTransaction(Transaction transaction){
        String command= transaction.getCommand();
        //Custom commands which do not require notification
        if(command.split(" ")[0].equals("USER")){
            username= command.split(" ")[1];
            System.out.println("Processor username set to: "+username);
            return;
        }
        if(command.split(" ")[0].equals("PASS")){
            isLoggedIn=true;
            System.out.println("Login successful, processor is considered authenticated");
            return;
        }
        if(command.split(" ")[0].equals("CWD")){
            String newDir= command.split(" ")[1];
            if(topLevelFolder==null){
                //Set top level folder with the first cwd command that it is sent
                topLevelFolder=newDir;
                currentFolder=topLevelFolder;
                System.out.println("Top level folder set to: "+topLevelFolder);
            }else{
                //TODO: MANAGE DIRECTORY CHANGES
                System.out.println("CWD management TBI");
            }
            return;
        }

        //Notify transaction by default if previous commands were not encountered
        System.out.println("Notifying "+(openedConnections.size()-1)+" subscribers");
        for(ProxyConnectionProcessor conn: openedConnections){
            if(/*!this.equals(conn) &&*/ conn.isLoggedIn){
                //Check if it is logged in as the same user and with the same top folder
                if(username.equals(conn.username) && topLevelFolder.equals(conn.topLevelFolder)){
                    if(conn.linkedWebSocketConn!=null){
                        System.out.println("Notifying: "+command+" to client processor: "+conn);
                        conn.linkedWebSocketConn.send(command);
                    }
                }
            }
        }
    }



    //Validate transactions
    private boolean interceptCommand(String command){
        String commandName= command.split(" ")[0];
        for(String acceptedCommand: commandsToIntercept){
            if(commandName.equals(acceptedCommand)) return true;
        }
        return false;
    }
    private boolean assertTransactionRequiresInterceptAndIsValid(Transaction transaction){
        String command= transaction.getCommand();
        if(!interceptCommand(command)) return false;
        if(!TransactionValidator.validateTransaction(transaction)) return false;
        System.out.println("** Intercepted transaction: "+command);
        //If all checks pass
        return true;
    }
}
