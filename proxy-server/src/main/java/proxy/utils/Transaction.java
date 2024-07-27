package proxy.utils;
import java.util.List;
import java.util.ArrayList;
public class Transaction {
    private boolean passThrough=true;
    private String command;
    private List<String> responses;
    public Transaction(){
        command=null;
        responses=new ArrayList<>();
    }

    public void setPassThrough(boolean value){this.passThrough=value;}
    public boolean canPassThrough(){return this.passThrough;}

    public void addCommand(String command){
        clear(); //resets transaction
        this.command=command;
    }
    public void addResponse(String response){
        responses.add(response);
    }

    public String getCommand(){
        return this.command;
    }

    public List<String> getResponses(){
        return this.responses;
    }

    public void clear(){
        command=null;
        responses=new ArrayList<>();
        this.passThrough=true;
    }
}
