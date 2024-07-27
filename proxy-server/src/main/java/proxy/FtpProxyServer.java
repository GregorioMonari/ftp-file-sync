package proxy;

import java.io.*;
import java.net.*;
import java.util.List;
import java.util.ArrayList;

public class FtpProxyServer {
    private int currConnIDNumber=0;
    private int PROXY_PORT = 2121; // Port for the proxy server
    private String FTP_SERVER_HOST = "localhost"; // Actual FTP server hostname
    private int FTP_SERVER_PORT = 21; // Actual FTP server port
    public final List<ProxyConnectionProcessor> openedConnections;

    public FtpProxyServer(int proxyPort, String ftpHost, int ftpPort){
        PROXY_PORT= proxyPort;
        FTP_SERVER_HOST= ftpHost;
        FTP_SERVER_PORT= ftpPort;
        openedConnections =  new ArrayList<>();
    }

    public void start() {
        try (ServerSocket proxyServerSocket = new ServerSocket(PROXY_PORT)) {
            System.out.println("FTP Proxy Server started on port " + PROXY_PORT);
            while (true) {
                try{
                    Socket clientSocket = proxyServerSocket.accept();
                    System.out.println("** Creating new proxy connection for client: "+clientSocket.toString());
                    //Ftp server stream
                    Socket ftpSocket = new Socket(FTP_SERVER_HOST, FTP_SERVER_PORT);
                    String proxyConnID= "id-"+currConnIDNumber;
                    currConnIDNumber++;
                    openedConnections.add(new ProxyConnectionProcessor(clientSocket,ftpSocket,openedConnections,proxyConnID));
                    System.out.println("Opened connections: "+ openedConnections.size());
                }catch (IOException e) {
                    e.printStackTrace();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
