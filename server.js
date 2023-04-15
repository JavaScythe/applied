const WebSocket = require("ws");
const { nanoid } = require('nanoid');
const { createHash } = require('crypto');
let ws = new WebSocket.Server({
	noServer: true
});
let rescueTimeout = {};
class Peer {
    deeps = [];
    url = null;
    mode = null;
    sharedKey = null;
    state = null;
    id = null;
    manager = null;
    constructor(url, mode, sharedKey, state, id, manager){
        this.url = url;
        this.mode = mode;
        this.sharedKey = sharedKey;
        this.state = state;
        this.id = id;
        this.manager = manager;
    }
}
const axios = require("axios");
let grid = [];
ws.on("connection", (socket, request) => {
    socket.id = nanoid(20);
    console.log(`peer ${socket.id} connected`);
    console.log(`querying peer ${socket.id} mode`);
    socket.send(JSON.stringify({
        type: "modequery",
        demand: true
    }));
    socket.on("message", async (data) => {
        if(data.type == "moderesponse"){
            console.log(`peer ${socket.id} is ${data.mode} mode`);
            if(data.mode == "deep"){
                let sharedKey = nanoid(40);
                try{
                    let dt = await axios.get(data.url);
                    if(dt.data.type!="verify"){
                        socket.close();
                        return false;
                    }
                } catch(e){
                    console.log(`peer ${socket.id} failed to verify`);
                    socket.close();
                    return false;
                }
                let options = map.filter((peer) => {
                    return peer.mode == "manager";
                });
                let manager = options[0];
                for(let i = 0; i < options.length; i++){
                    if(options[i].deeps.length < manager.deeps.length){
                        manager = options[i];
                    }
                }
                let peer = new Peer(data.url, "deep", sharedKey, "handshaking", socket.id, manager.id);
                grid.push(peer);
                manager.deeps.push(peer.id);
                socket.send(JSON.stringify({
                    type: "handshake",
                    sharedKey: sharedKey,
                    target: manager.url
                }));
            } else if(data.mode == "manager"){
                let sharedKey = nanoid(40);
                try{
                    let dt = await axios.get(data.url);
                    if(dt.data.type!="verify"){
                        socket.close();
                        return false;
                    }
                } catch(e){
                    console.log(`peer ${socket.id} failed to verify`);
                    socket.close();
                    return false;
                }
                let peer = new Peer(data.url, "manager", sharedKey, "handshaking", socket.id, null);
                grid.push(peer);
                socket.send(JSON.stringify({
                    type: "handshake",
                    sharedKey: sharedKey
                }));
            }
        } else if(data.type == "handshake"){
            let peer = grid.filter((peer) => {
                return peer.id == socket.id;
            });
            peer = peer[0];
        	if(peer==undefined){
                socket.close();
        	    return false;
            }
            if(peer.state == "shaking"){
                if(peer.sharedKey != data.sharedKey){
                    console.log(`peer ${socket.id} failed handshake`);
                    socket.close();
                    return false;
                }
                peer.state = "connected";
                socket.send(JSON.stringify({
                    type: "execute",
                    sharedKey: createHash('sha256').update(peer.sharedKey).digest('hex'),
                    payload: {
                        "type": "GET",
                        "url": "https://example.com"
                    }
                }));
            }
        }
    });
    socket.on("close", () => {
        console.log(`peer ${socket.id} disconnected`);
        let removed = grid.filter((peer) => {
            return peer.id == socket.id;
        });
        removed = removed[0];
        grid = grid.filter((peer) => {
            return peer.id != socket.id;
        });
        if(removed.mode == "manager"){
            //send rescue poll to all deeps
            for(let i in grid){
                if(grid[i].manager == removed.id){
                    grid[i].manager = null;
                }
                rescue(grid[i].url);
            }
        } else if(removed.mode == "deep"){
            for(let i in grid){
                if(grid[i].mode == "manager"){
                    grid[i].deeps = grid[i].deeps.filter((id) => {
                        return id != removed.id;
                    });
                }
            }

        }
    });
});
function rescue(url){
    axios.get("https://"+url+"/rescue").then((res) => {
        if(data.ok){
            console.log("peer accepted rescue");
        } else {
            setTimeout((url) => {
                rescue(url);
            }, 2000, url);
        }
    }).catch((err) => {
        console.log("peer failed to accept rescue", err);
        setTimeout((url) => {
            rescue(url);
        }, 2000, url);
    });
}
const app = require("express")();
app.get("/", (req, res) => {    
    res.sendFile(__dirname + "/index.html");
});
let server = app.listen(3000);
server.on('upgrade', (request, socket, head) => {
	ws.handleUpgrade(request, socket, head, socket => {
		ws.emit('connection', socket, request);
	});
});