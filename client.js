const {io} = require("socket.io-client");

const socket = io("ws://localhost:3000/couple");

socket.on('connect', () => {
    console.log('Connected to the server')
   })
// send a message to the server
socket.on("message", data => {
   console.log(data)
})

socket.on("not-sent", (message) => {
   console.log(message)
})
const messages = ["Dinner at my house tonight are you down?","how are you", "my god","so sick", "I think KSI is going to win","Deji should lose"]
for(let i = 0; i < 100; i++) {
   let curr = i % messages.length
   setTimeout(()=> {
      socket.emit("text-message",messages[curr])
   },3000 * i)
}


socket.on("connect_error", (error) => {
    console.log(error.message)
    socket.auth = {user: {id:"brow"}, coupleId:"whatbamaa"};
    socket.connect();
  });