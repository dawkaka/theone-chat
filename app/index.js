"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const io = new socket_io_1.Server();
const pubClient = (0, redis_1.createClient)({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();
console.log("hello");
io.on("connection", socket => {
    socket.emit("connected", 1, 2, 3, 3);
    console.log("connected");
});
io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
io.listen(3000);
console.log("Hi");
