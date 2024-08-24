package proxy.utils;

import java.util.List;

public class TransactionValidator {
    public static boolean validateTransaction(Transaction transaction){
        String command=transaction.getCommand();
        String commandName= command.split(" ")[0];
        List<String> responses= transaction.getResponses();
        String error=null;
        switch (commandName){
            case "USER":
                if(responses.size()!=1) return false;//error= "responses size != 1 ("+responses.size()+")";
                if(!responses.get(0).startsWith("331 Please specify the password.")) error= responses.get(0);
                break;
            case "PASS":
                if(responses.size()!=1) return false;//error= "responses size != 1 ("+responses.size()+")";
                if(!responses.get(0).startsWith("230 Login successful.")) error= responses.get(0);
                break;
            case "CWD":
                if(responses.size()!=1) return false;//error= "responses size != 1 ("+responses.size()+")";
                if(!responses.get(0).startsWith("250 Directory successfully changed.")) error= responses.get(0);
                break;
            case "STOR":
                if(responses.size()!=2) return false;//error= "responses size != 2 ("+responses.size()+")";
                if(!responses.get(0).startsWith("150 Ok to send data.")) error= responses.get(0);
                if(!responses.get(1).startsWith("226 Transfer complete.")) error= responses.get(1);
                break;
            case "MKD":
                if(responses.size()!=1) return false;
                if(!responses.get(0).startsWith("257 ")) error= responses.get(0);
                break;
            case "DELE":
                if(responses.size()!=1) return false;
                if(!responses.get(0).startsWith("250 Delete operation successful.")) error= responses.get(0);
                break;
            case "RMD":
                if(responses.size()!=1) return false;
                if(!responses.get(0).startsWith("250 Remove directory operation successful.")) error= responses.get(0);
                break;
            default:
                error="command not present in whitelist";
                break;
        }

        if(error==null){
            return true;
        }else{
            System.out.println("Invalid Ftp transaction response: "+error);
            return false;
        }
    }
}
