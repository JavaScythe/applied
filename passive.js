const WebSocket = require("ws");
const { createHash } = require('crypto');
const fs = require("fs");
const jwt = require("jsonwebtoken");
class Peer {
	//slave <--> master config
	slaves = [];
	master = null;
	type = null;

	//height asigns third dimension to network map
	//height is based on trust interactions, capped at +100, -500
	height = 0;
	setHeight(height){
		this.height = height;
		if(this.height > 100){
			this.height = 100;
		} else if(height < -500){
			this.height = -500;
		}
		return this.height;
	}
	//critical info
	url = null;
	key = null;
	state = null;
	id = null;

	//extra info
	lastPingDate = null;
	lastPingTime = null;
	lastConnectDate = null;
	registerDate = null;
	lastConnectedIp = null;

	constructor(height, url, key, state, id){
		this.height = height;
		this.url = url;
		this.key = key;
		this.state = state;
		this.id = id;
	}
}
let pingTimeouts = {};
let pingService = setInterval(() => {
	for(let i = 0; i < db.length; i++){
		let node = db[i];
		if(node.state == "online"){
			ws.clients.forEach((client) => {
				if(client.id == node.id){
					ping(client)
				}
			});
		}
	}
}, 1000);
let trustTimeouts = {};
let trustService = setInterval(() => {
	for(let i = 0; i < db.length; i++){
		let node = db[i];
		if(node.state == "online"){
			ws.clients.forEach((client) => {
				if(client.id == node.id){
					trust(client)
				}
			});
		}
	}
}, 1000);
let db = JSON.parse(fs.readFileSync(__dirname + "/keys.json"));
let caches = {
	"urls": [],
	"keys": [],
	"ids": []
}
function updateCache(){
	fs.writeFileSync(__dirname + "/keys.json", JSON.stringify(db));
	caches.urls = [];
	caches.keys = [];
	caches.ids = [];
	for(let i = 0; i < db.length; i++){
		caches.urls.push(db[i].url);
		caches.keys.push(db[i].key);
		caches.ids.push(db[i].id);
	}
}
updateCache();
const ws = new WebSocket.Server({
    noServer: true
});
const app = require("express")();
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});
app.get("/status", (req, res) => {
	res.send(db);
});
app.use(require("body-parser").json());
app.post("/register", (req, res) => {
	if(req.body.key == undefined){
		res.sendStatus(400);
		return false;
	}
	let key = req.body.key;
	let url = req.body.url;
	if(caches.keys.includes(key) || caches.urls.includes(url)){
		res.sendStatus(401);
		return false;
	}
	let node = new Peer(0, req.body.url, req.body.key, "offline", createHash("sha256").update(req.body.key + req.body.url).digest("hex"));
	node.lastConnectDate = new Date().getTime();
	node.registerDate = new Date().getTime();
	node.lastConnectedIp = req.ip;
	node.type = "master";
	console.log("updated", node);
	db.push(node);
	updateCache();
	res.send({
		id: node.id,
		success: true
	});
});
function ping(socket){
	pingTimeouts[socket.id] = {
		time: new Date().getTime(),
		timeout: setTimeout(() => {
			let node = db[caches.ids.indexOf(socket.id)];
			node.state = "offline";
			delete pingTimeouts[socket.id];
		}, 10000)
	};
	socket.send(JSON.stringify({
		type: "ping"
	}));
}
function trust(socket){
	let a = Math.floor(Math.random() * 1000);
	let b = Math.floor(Math.random() * 1000);
	trustTimeouts[socket.id] = {
		time: new Date().getTime(),
		answer: a+b,
		timeout: setTimeout(() => {
			let node = db[caches.ids.indexOf(socket.id)];
			node.state = "offline";
			delete trustTimeouts[socket.id];
		}, 10000)
	};
	socket.send(JSON.stringify({
		type: "trust",
		payload: a+"+"+b
	}));
}
ws.on("connection", (socket, req) => {
	socket.on("message", (data) => {
		data = data.toString();
		if(data[0] == "{"){
			data = JSON.parse(data);
			if([
				"pong"
			].indexOf(data.type) !== -1){
				socket.send(JSON.stringify({
					type: "error",
					error: "type requires signing"
				}));
				return false;
			}
		} else {
			try{
				if(db[caches.ids.indexOf(socket.id)] == undefined){
					socket.send(JSON.stringify({
						type: "error",
						error: "not registered"
					}));
					return false;
				}
				data = jwt.verify(data, db[caches.ids.indexOf(socket.id)].key);
			} catch(e){
				socket.send(JSON.stringify({
					type: "error",
					error: "invalid token"
				}));
				return false;
			}
		}
		if(data.type == "login"){
			if(data.key == undefined || data.url == undefined){
				socket.send(JSON.stringify({
					type: "error",
					error: "missing field"
				}));
				return false;
			}
			let key = data.key;
			let url = data.url;
			console.log(key, url);
			console.log(caches);
			console.log(db);
			if(!caches.keys.includes(key) || !caches.urls.includes(url)){
				socket.send(JSON.stringify({
					type: "error",
					error: "invalid key or url"
				}));
				return false;
			}
			let node = db[caches.keys.indexOf(key)];
			if(node.url != url){
				socket.send(JSON.stringify({
					type: "error",
					error: "invalid key or url"
				}));
				return false;
			}
			if(node.state == "online"){
				socket.send(JSON.stringify({
					type: "error",
					error: "node is already online"
				}));
				return false;
			}
			node.state = "online";
			node.lastConnectDate = new Date().getTime();
			node.lastConnectedIp = req.ip;
			socket.id = node.id;
			socket.send(JSON.stringify({
				type: "success",
				id: node.id
			}));
			ping(socket);
		} else if(data.type == "pong"){
			if(pingTimeouts[socket.id].time != undefined){
				let node = db[caches.ids.indexOf(socket.id)];
				node.lastPingDate = new Date().getTime();
				node.lastPingTime = new Date().getTime() - pingTimeouts[socket.id].time;
				console.log("pong", node.lastPingTime);
				clearTimeout(pingTimeouts[socket.id].timeout);
				delete pingTimeouts[socket.id];
			}
		}
	});
	socket.on("close", () => {
		if(socket.id != undefined){
			let node = db[caches.ids.indexOf(socket.id)];
			node.state = "offline";
			delete pingTimeouts[socket.id];
		}
	});
});
let server = app.listen(3000);
server.on('upgrade', (request, socket, head) => {
    ws.handleUpgrade(request, socket, head, socket => {
        ws.emit('connection', socket, request);
    });
});