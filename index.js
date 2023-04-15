const app = require("express")();
const axios = require("axios");
const WebSocket = require("ws");
let numbers = {
    versionTicks: 0,
    installs: 0,
    navs: 0
};
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});
app.get("/api/version", (req, res) => {t
    numbers.versionTicks++;
    res.json({
        version: "0.3-basepatch",
        since: "4/14/2023"
    });
});
app.get("/api/installs", (req, res) => {
    numbers.installs++;
    res.sendStatus(200);
});
app.get("/api/navs", (req, res) => {
    numbers.navs++;
    res.sendStatus(200);
});
app.use('/api/latest', createProxyMiddleware({ target: 'https://raw.githubusercontent.com/JavaScythe/bnkr-pro/main/dist/', changeOrigin: true }));
app.listen(3000); 