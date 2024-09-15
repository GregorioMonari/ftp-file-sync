import { rejects } from "assert";
import sqlite3 , {Database} from "sqlite3"
export interface QueryRecord{
  [key:string]:string|number|null
}

export type FieldType = "DATETIME"|"INTEGER"|"REAL"|"TEXT"|"NUMERIC"|"BLOB"|"BOOLEAN"|string

export class SqliteDriver{
    private db:Database;
    private dbPath:string;
    private connected:boolean;
    constructor(_dbPath:string){
        this.dbPath=_dbPath;
        this.db = new sqlite3.Database(this.dbPath);
        this.connected=true;
    }

    getDb(){
      return this.db
    }

    async tableExists(tableName:string):Promise<boolean>{
      const res=await this.queryData("sqlite_master",["name"],"type='table' AND name='"+tableName+"'")
      return res.length>0
    }

    async tableIsEmpty(tableName:string):Promise<boolean>{
      const res=await this.queryData(tableName,["COUNT(*)"],null)
      if(res.length==0) return true;
      const count= res[0]["COUNT(*)"];
      return count==0
    }

    updateRows(tableName:string,data:{[key:string]:string|number|null},condition: string){
      return new Promise((resolve,reject)=>{
        const set=Object.keys(data).map(k=>{
          return k+"="+data[k]
        }).join(",")
        let sql = `UPDATE ${tableName} SET ${set} WHERE ${condition}`;
        //console.log(sql)
        this.db.run(sql, (error) => {
          if (error) {
            console.error('Error updating records:', error.message);
            reject(error)
          }else{
            resolve(true)
          }
        });
      })
    }

    queryData(tableName: string, columns: string[], condition: string | null): Promise<QueryRecord[]> {
      return new Promise((resolve,reject)=>{
        let sql = `SELECT ${columns.join(', ')} FROM ${tableName}`;
    
        if (condition) {
          sql += ` WHERE ${condition}`;
        }
        //console.log(sql)
        this.db.all(sql, (error, rows:any) => {
          if (error) {
            console.error('Error querying data:', error.message);
            reject(error)
          } else {
            resolve(rows)
          }
        });
      })
    }

    addManyRows(tableName:string, data:{
      [key:string]: string|number|null
    }[]){
      return new Promise((resolve,reject)=>{
        const columns = Object.keys(data[0]);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const dataToInsert = data.map((value) => columns.map((column) => value[column]));

        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');

          const stmt = this.db.prepare(sql);

          dataToInsert.forEach((data) => {
            stmt.run(data, (error) => {
              if (error) {
                console.error('Error inserting data:', error.message);
                reject(error)
              }
            });
          });

          stmt.finalize();

          this.db.run('COMMIT', (error) => {
            if (error) {
              console.error('Error committing transaction:', error.message);
              reject(error)
            } else {
              resolve(true)
            }
          });
        });
      })
    }

    addRow(tableName:string,data:any){
      return new Promise((resolve,reject)=>{
        const headers=Object.keys(data).join(",")
        let variables="";
        for(var i=0; i<Object.keys(data).length-1;i++){
          variables=variables+"?,"
        }
        variables=variables+"?"
        let values:string[]=[]
        Object.keys(data).forEach(k=>{
          values.push(data[k])
        })
        const sql = `INSERT INTO ${tableName} (${headers}) VALUES (${variables})`;
        this.db.run(sql, values, (error) => {
          if (error) {
            console.error('Error inserting data:', error.message);
            reject(error)
          }else{
            resolve(true)
          }
        });
      })
    }

    deleteRow(tableName: string, condition: string, values: any[]) {
      return new Promise((resolve, reject) => {
          const sql = `DELETE FROM ${tableName} WHERE ${condition}`;
          this.db.run(sql, values, (error) => {
              if (error) {
                  console.error('Error deleting data:', error.message);
                  reject(error);
              } else {
                  resolve(true);
              }
          });
      });
  }




    createTable(tableName:string,schema:{[key:string]:FieldType}){
      return new Promise((resolve,reject)=>{
        let stringSchema:string[]=[];
        Object.keys(schema).forEach(k=>{
          stringSchema.push(`${k} ${schema[k]}`)
        })

        const sql=`CREATE TABLE "${tableName}" (${stringSchema.join(",")})`
        console.log(sql)
        this.db.run(sql, (err:any) => {
          if (err) {
            console.error(`Error creating table: ${err.message}`);
            reject(err)
          }else{
            resolve(true)
          }
        });
      })
    }

    cleanTable(tableName:string){
      return new Promise((resolve,reject)=>{
        const sql = `DELETE FROM ${tableName}`;
        this.db.run(sql, (error) => {
          if (error) {
            console.error('Error truncating table:', error.message);
            reject(error)
          }else{
            resolve(true)
          }
        });
      })
    }

    rawQuery(rawQuery:string){
      return new Promise((resolve,reject)=>{
        this.db.run(rawQuery, (err:any) => {
          if (err) {
            console.error(`Error in sql query: ${err.message}`);
            reject(err)
          }else{
            resolve(true)
          }
        });
      })
    }

    isConnected(){
      return this.connected
    }

    disconnect(){
      if(this.connected){
        this.db.close();
        this.connected=false;
      }else{
        console.log("Already disconnected")
      }
    }

    reconnect(){
      if(!this.connected){
        this.db = new sqlite3.Database(this.dbPath);
        this.connected=true;
      }else{
        console.log("Already connected")
      }
    }
}