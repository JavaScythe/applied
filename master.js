const axios = require('axios');
const { createHash } = require('crypto');
const fs = require("fs");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
let ws;
let key = fs.existsSync(__dirname + "/key.pem");
if(!key){
    key = createHash("sha256").update(Math.random().toString()).digest("hex");
    fs.writeFileSync(__dirname + "/key.pem", key);
    register();
} else {
    key = fs.readFileSync(__dirname + "/key.pem", "utf-8");
    start();
}
async function register(){
    try{
        let id = await axios.post("http://localhost:3000/register", {
            key: key,
            url: "localhost:3000"
        });
        console.log("Registered");
        start();
    }catch(e){
        console.log("failed to register", e);
    }
}
async function start(){
    ws = new WebSocket("ws://localhost:3000");
    ws.on("open", () => {
        console.log("Connected to central");
        ws.send(JSON.stringify({
            type: "login",
            key: key,
            url: "localhost:3000"
        }));
    });
    ws.on("message", (data) => {
        data = JSON.parse(data);
        console.log(data);
        if(data.type == "ping"){
            ws.send(jwt.sign({
                type: "pong"
            }, key));
        }
    });
}