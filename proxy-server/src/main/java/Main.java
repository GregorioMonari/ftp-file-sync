import proxy.Proxy;

public class Main {
    public static void main(String[] args) {
        System.out.println("####################");
        System.out.println("# FTP Proxy Server #");
        System.out.println("####################");

        //Endpoint
        String ftpHost= "localhost";
        int ftpPort= 21;
        //Proxy
        int proxyPort= 2121;
        int wsPort= 9666;
        Proxy proxyServer= new Proxy(ftpHost,ftpPort,proxyPort,wsPort);
        proxyServer.start();
    }
}