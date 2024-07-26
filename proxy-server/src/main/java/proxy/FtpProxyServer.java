package proxy;

import java.io.*;
import java.net.*;
import java.util.List;
import java.util.ArrayList;

public class FtpProxyServer {
    private int PROXY_PORT = 2121; // Port for the proxy server
    private String FTP_SERVER_HOST = "localhost"; // Actual FTP server hostname
    private int FTP_SERVER_PORT = 21; // Actual FTP server port
    private final List<ProxyConnectionProcessor> openedConnections;

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
                    openedConnections.add(new ProxyConnectionProcessor(clientSocket,ftpSocket,openedConnections));
                    System.out.println("Opened connections: "+ openedConnections.size());
                }catch (IOException e) {
                    e.printStackTrace();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    //OLD THREAD CODE FOR HANDLING INCOMING CONNECTIONS
    /*static class FtpClientHandler implements Runnable {
        private final Socket clientSocket;

        public FtpClientHandler(Socket clientSocket) {
            this.clientSocket = clientSocket;
        }

        @Override
        public void run(){
            try (
                    //Client stream
                    InputStream clientIn = clientSocket.getInputStream();
                    OutputStream clientOut = clientSocket.getOutputStream();
                    //Ftp server stream
                    Socket ftpSocket = new Socket(proxy.FtpProxyServer.FTP_SERVER_HOST, proxy.FtpProxyServer.FTP_SERVER_PORT);
                    InputStream ftpIn = ftpSocket.getInputStream();
                    OutputStream ftpOut = ftpSocket.getOutputStream();
                    //Buffers
                    BufferedReader clientReader = new BufferedReader(new InputStreamReader(clientIn));
                    BufferedWriter clientWriter = new BufferedWriter(new OutputStreamWriter(clientOut));
                    BufferedReader ftpReader = new BufferedReader(new InputStreamReader(ftpIn));
                    BufferedWriter ftpWriter = new BufferedWriter(new OutputStreamWriter(ftpOut));
            ) {

            } catch (IOException e) {
                e.printStackTrace();
            }
        }


        @Override
        public void run() {
            try (
                    //Client stream
                    InputStream clientIn = clientSocket.getInputStream();
                    OutputStream clientOut = clientSocket.getOutputStream();
                    //Ftp server stream
                    Socket ftpSocket = new Socket(proxy.FtpProxyServer.FTP_SERVER_HOST, proxy.FtpProxyServer.FTP_SERVER_PORT);
                    InputStream ftpIn = ftpSocket.getInputStream();
                    OutputStream ftpOut = ftpSocket.getOutputStream();
                    //Buffers
                    BufferedReader clientReader = new BufferedReader(new InputStreamReader(clientIn));
                    BufferedWriter clientWriter = new BufferedWriter(new OutputStreamWriter(clientOut));
                    BufferedReader ftpReader = new BufferedReader(new InputStreamReader(ftpIn));
                    BufferedWriter ftpWriter = new BufferedWriter(new OutputStreamWriter(ftpOut));
            ) {

                //MANAGE SERVER INITIAL RESPONSE;
                String initialResponse = ftpReader.readLine();
                if(initialResponse!=null){
                    System.out.println("Server initial response: "+initialResponse);
                    clientWriter.write(initialResponse + "\r\n");
                    clientWriter.flush();
                    System.out.println("Initial response forwarded to client");
                }else{
                    System.out.println("No initial response from server, skipping welcome message phase");
                }

                //MANAGE COMMANDS
                System.out.println("Listening for incoming FTP commands...");
                String command;
                String response;

                while(!clientSocket.isClosed() && !ftpSocket.isClosed()){
                    if(clientReader.ready()){ //bufferin full
                        command = clientReader.readLine();
                        if(command != null) {
                            System.out.println("Received command: " + command);
                            //Forward command to server
                            ftpWriter.write(command + "\r\n");
                            ftpWriter.flush();
                        }
                    }
                }

                while(!clientSocket.isClosed() && !ftpSocket.isClosed()){
                    command = clientReader.readLine();
                    if(command != null) {
                        System.out.println("Received command: " + command);
                        //Forward command to server
                        ftpWriter.write(command + "\r\n");
                        ftpWriter.flush();


                        response=ftpReader.readLine();
                        if(isMultilineResponseStart(response)){
                            System.out.println("* Sending start of multiline response: " + response);
                            clientWriter.write(response + "\r\n");
                            clientWriter.flush();
                            String responseStart=response;

                            //Manage rest of multiline response
                            while (true) {
                                response=ftpReader.readLine();
                                if(response!=null){
                                    System.out.println("Sending response: " + response);
                                    clientWriter.write(response + "\r\n");
                                    clientWriter.flush();
                                    if(isMultilineResponseEnd(responseStart,response)) break;
                                }
                            }
                            System.out.println("* multiline response ended");
                        }else{
                            System.out.println("Sending response: " + response);
                            clientWriter.write(response + "\r\n");
                            clientWriter.flush();
                        }

                        System.out.println("Finished transaction");
                    }
                }
                System.out.println("Socket closed, stopping thread");
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        public boolean isMultilineResponseStart(String firstResponse){
            Pattern pattern = Pattern.compile("^\\d{3}-");
            Matcher matcher = pattern.matcher(firstResponse);
            return matcher.find();
        }
        public boolean isMultilineResponseEnd(String firstResponse, String response){
            //Check correct format
            Pattern pattern = Pattern.compile("^\\d{3} ");
            Matcher matcher = pattern.matcher(response);

            if(matcher.find()){
                String firstResponseCode= firstResponse.split("-")[0];
                String responseCode= response.split(" ")[0];
                if(firstResponseCode.equals(responseCode)) return true;
            }
            return false;
        }
    }*/
}
