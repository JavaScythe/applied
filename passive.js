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
app.post("/register", (req, res) => {
	if(req.body.key == undefined){
		res.sendStatus(400);
		return false;
	}
	let key = req.body.key;
	if(caches.keys.includes(key)){
		res.sendStatus(403);
		return false;
	}
});

let server = app.listen(3000);
server.on('upgrade', (request, socket, head) => {
    ws.handleUpgrade(request, socket, head, socket => {
        ws.emit('connection', socket, request);
    });
});