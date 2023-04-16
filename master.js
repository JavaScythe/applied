const axios = require('axios');
const { createHash } = require('crypto');
const fs = require("fs");
let key = fs.readFileSync(__dirname + "/key.pem");
if(key == ""){
    key = createHash("sha256").update(Math.random().toString()).digest("hex");
    fs.writeFileSync(__dirname + "/key.pem", key);
    register();
}
async function register(){
    try{
        let id = await axios.post("localhost:3000/register", {
            key: key,
            url: "localhost:3000"
        });
        if(id.data == "ok"){
            console.log("Registered");
        }else{
            console.log("Error registering");
        }
    }catch(e){
        console.log(e);
    }
}