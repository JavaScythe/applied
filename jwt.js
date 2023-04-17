const jwt = require("jsonwebtoken");
let key = jwt.sign({
    type: "slave",
    key: "test3425w36475u"
}, "testkey", {
    expiresIn: "10s"
});
console.log(key);
console.log(jwt.verify(key, "testkey"));
console.log(jwt.decode('{"key":024543}'));