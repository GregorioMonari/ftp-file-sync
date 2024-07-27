package proxy;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.List;

public class WsConnectionFactory extends WebSocketServer{
    private final List<ProxyConnectionProcessor> openedFtpConnections;
    //Keep track of linked ws sockets with ftp sockets
    public HashMap<WebSocket,ProxyConnectionProcessor> linkedSockets = new HashMap<>();
    public WsConnectionFactory(int port, List<ProxyConnectionProcessor> openedFtpConnections) {
        super(new InetSocketAddress(port));
        this.openedFtpConnections= openedFtpConnections;
    }

    @Override
    public void onOpen(WebSocket webSocket, ClientHandshake clientHandshake) {
        System.out.println("WebSocket connection opened: " + webSocket.getRemoteSocketAddress());
    }
    @Override
    public void onClose(WebSocket webSocket, int i, String s, boolean b) {
        System.out.println("WebSocket connection closed: " + webSocket.getRemoteSocketAddress());
        linkedSockets.remove(webSocket);
    }
    @Override
    public void onMessage(WebSocket webSocket, String s) {
        System.out.println("** New message received: "+s);
        if(!linkedSockets.containsKey(webSocket)){
            //Try to link a new connection to an existing proxy processor
            for(ProxyConnectionProcessor ftpConn: openedFtpConnections){
                String connID= ftpConn.proxyConnID;
                if(s.equals(connID)){
                    webSocket.send("ok");
                    //Link WS
                    linkedSockets.put(webSocket,ftpConn);
                    ftpConn.linkedWebSocketConn=webSocket;
                    System.out.println("Linked WebSocket with ID "+connID+" to "+ftpConn.toString());
                    break;
                }
            }
        }
    }

    public void sendUpdate(WebSocket conn, String update) {
        conn.send(update);
    }


    @Override
    public void onError(WebSocket webSocket, Exception e) {
        e.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server listening");
    }
}
