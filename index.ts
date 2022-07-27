import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import axios from 'axios'

const io = new Server();
const pubClient = createClient({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();

interface userSession {
  hasPartner: boolean,
  couple_id: string,
  id: string,
  partnerId: string,
  name: string;
  firstName: string,
  lastName: string
}

//Namespace for messages between couple
const couple = io.of("/couple")
couple.use(async (socket, next) => {
  try {
    const user = await axios.get(`${process.env.GoServer!}/user/session`,{withCredentials: true}) as userSession
    if(user.hasPartner) {
      socket.handshake.auth.user = user
      next()
    }else {
      next(new Error("Doesn't have a partner"))
    }
  } catch (error) {
    const err = new Error("Not authorized");
    next(err);
  }
});

couple.on("connection", socket => {
  const coupleId = socket.handshake.auth.user.couple_id
  socket.join(coupleId)

  socket.on("message", data => {
    couple.to(coupleId).emit("message", data)
  })

  socket.on("is-typing", data => {
    couple.to(coupleId).emit("is-typing", data)
  })
})

//Namespace for messages among couple and user
const coupleAndUser = io.of("/couple-and-user")
coupleAndUser.use(async (socket, next) => {
  try {
    const user = await axios.get(`${process.env.GoServer!}/user/session`,{withCredentials: true}) as userSession
    socket.handshake.auth.user = user
    next()
  } catch (error) {
    next(new Error("Not authorized"))
  }
})

coupleAndUser.on("connection", socket => {
  let room = ""
  const user = socket.handshake.auth.user
  if(user.hasPartner) {
    room = user.couple_id + "_" + socket.handshake.auth.userId
  }else {
    room = socket.handshake.auth.coupleId + "_" + user.id
  }
  socket.join(room)

  socket.on("message", data => {
    couple.to(room).emit("message", data)
  })

  socket.on("is-typing", data => {
    couple.to(room).emit("is-typing", data)
  })
  
})

io.adapter(createAdapter(pubClient, subClient));
io.listen(3000);