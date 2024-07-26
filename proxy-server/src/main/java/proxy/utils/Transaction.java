package proxy.utils;
import java.util.List;
import java.util.ArrayList;
public class Transaction {
    private String command;
    private List<String> responses;
    public Transaction(){
        command=null;
        responses=new ArrayList<>();
    }

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
    }
}
