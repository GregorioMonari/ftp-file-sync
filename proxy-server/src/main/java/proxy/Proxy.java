package proxy;

public class Proxy {
    String ftpHost; int ftpPort,proxyPort,wsPort;
    public Proxy(String ftpHost, int ftpPort, int proxyPort, int wsPort){
        this.ftpHost= ftpHost;
        this.ftpPort= ftpPort;
        this.proxyPort= proxyPort;
        this.wsPort= wsPort;
    }

    public void start(){
        //Create and start server
        FtpProxyServer proxyServer= new FtpProxyServer(proxyPort,ftpHost,ftpPort);
        new Thread(new FtpRunner(proxyServer)).start();
        new Thread(new WsRunner(new WsConnectionFactory(wsPort,proxyServer.openedConnections))).start();
    }


    private class WsRunner implements Runnable {
        private final WsConnectionFactory server;
        public WsRunner(WsConnectionFactory serverInstance){
            this.server=serverInstance;
        }
        public void run(){
            server.start();
        }
    }
    private class FtpRunner implements Runnable {
        private final FtpProxyServer server;
        public FtpRunner(FtpProxyServer serverInstance){
            this.server=serverInstance;
        }
        public void run(){
            server.start();
        }
    }
}
