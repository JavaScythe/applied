const WebSocket = require("ws");
const { createHash } = require('crypto');
const fs = require("fs");
class Peer {
	//slave <--> master config
	slaves = [];
	master = null;

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
let db = JSON.parse(fs.readFileSync(__dirname + "/keys.json"));
let caches = {
	"urls": [],
	"keys": [],
	"ids": []
}
function updateCache(){
	caches.urls = [];
	caches.keys = [];
	caches.ids = [];
	for(let i = 0; i < db.length; i++){
		caches.urls.push(db[i].url);
		caches.keys.push(db[i].key);
		caches.ids.push(db[i].id);
	}
}
const ws = new WebSocket.Server({
    noServer: true
});
const app = require("express")();
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
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
ws.on("connection", (socket, req) => {
	socket.on("message", (data) => {
		data = JSON.parse(data);
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
		} else if(data.type == "pong"){
			if(pingTimeouts[socket.id].time != undefined){
				let node = db[caches.ids.indexOf(socket.id)];
				node.lastPingDate = new Date().getTime();
				node.lastPingTime = new Date().getTime() - pingTimeouts[socket.id].time;
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