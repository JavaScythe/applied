const axios = require('axios');
const { createHash } = require('crypto');
const fs = require("fs");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
let pingTimeouts = {};
let pingService = setInterval(() => {
	for(let i = 0; i < slaves.length; i++){
		let node = slaves[i];
		wss.clients.forEach((client) => {
            if(client.id == node.id){
                ping(client)
            }
        });
	}
}, 10000);
let slaves = [];
let wss = new WebSocket.Server({ port: 3001 });
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
function ping(socket){
	pingTimeouts[socket.id] = {
		time: new Date().getTime(),
		timeout: setTimeout(() => {
            slaves.find((slave) => {
                if(slave.id == socket.id){
                    slaves.splice(slaves.indexOf(slave), 1);
                }
            });
		}, 10000)
	};
	socket.send(JSON.stringify({
		type: "ping"
	}));
}
wss.on("connection", (socket) => {
    console.log("Slave connected");
    socket.on("message", (data) => {
        data = JSON.parse(data);
        console.log(data);
        if(data.type == "ping"){
            socket.send(jwt.sign({
                type: "pong"
            }, key));
        } else if(data.type == "slave"){
            let id = createHash("sha256").update(data.key+(Math.random()*999)).digest("hex");
            slaves.push({
                key: data.key,
                id: id
            });
            socket.id = id;
            socket.send(JSON.stringify({
                type: "id",
                id: id
            }));
        } else if(data.type == "pong"){
            if(pingTimeouts[socket.id].time != undefined){
				console.log("pong", new Date().getTime() - pingTimeouts[socket.id].time);
				clearTimeout(pingTimeouts[socket.id].timeout);
				delete pingTimeouts[socket.id];
			}
        }
    });
});
