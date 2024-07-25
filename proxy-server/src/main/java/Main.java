import proxy.FtpProxyServer;

public class Main {
    public static void main(String[] args) {
        System.out.println("####################");
        System.out.println("# FTP Proxy Server #");
        System.out.println("####################");

        //Configuration
        int proxyPort= 2121;
        String ftpHost= "localhost";
        int ftpPort= 21;
        //Create and start server
        FtpProxyServer server= new FtpProxyServer(proxyPort,ftpHost,ftpPort);
        server.start();
    }
}