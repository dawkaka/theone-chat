const {io} = require("socket.io-client");

const socket = io("ws://localhost:3000/couple");

socket.on('connect', () => {
    console.log('Connected to the server')
    console.log('Waiting for hotword...')
   })
// send a message to the server
socket.on("message", data => {
   console.log(data)
})

socket.emit("text-message","Dinner at my house tonight are you down?")

socket.on("connect_error", (error) => {
    console.log(error.message)
    socket.auth = {user: {couple_id:"brow"}};
    socket.connect();
  });