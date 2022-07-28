import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import dotenv from "dotenv";
import axios from 'axios';
import { ManagedUpload } from "aws-sdk/clients/s3";
import Joi from "joi"

import s3 from "./aws";
import { coupleMessageModel, groupMessageModel } from "./models"


dotenv.config()
const io = new Server();
const pubClient = createClient({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();
console.log(pubClient)

interface User {
  hasPartner: boolean,
  couple_id: string,
  id: string,
  partnerId: string,
  name: string;
  firstName: string,
  lastName: string
}

type MessageData = {
  message: string
}
type FileMessage = {
  contentType: string,
  file: Buffer,
  caption: string
}


const textMessageSchema = Joi.object({
  message: Joi.string().max(256).required(),
});
const fileMessageSchema = Joi.object({
  caption: Joi.string().allow("").max(256),
  contentType: Joi.string().equal("jpeg", "jpg", "png", "gif")
})

//Namespace for messages between couple
const couple = io.of("/couple")
couple.use(async (socket, next) => {
  if (socket.handshake.auth.user) {
    next()
  } else {
    try {
      const user = await axios.get(`${process.env.GoServer!}/user/session`, { withCredentials: true }) as User
      if (user.hasPartner) {
        socket.handshake.auth.user = user
        next()
      } else {
        next(new Error("Doesn't have a partner"))
      }
    } catch (error) {
      const err = new Error("Not authorized");
      next(err);
    }
  }
});

couple.on("connection", socket => {
  const coupleId = socket.handshake.auth.user.couple_id
  const userId = socket.handshake.auth.user.id
  const partnerId = socket.handshake.auth.user.partnerId
  socket.join([coupleId, userId])

  socket.on("text-message", async (message: MessageData) => {
    const from = userId
    const to = partnerId
    const date = new Date()
    const { error, value } = textMessageSchema.validate(message);
    if (error) {
      couple.in(from).emit("not-sent", error.message)
      return
    }
    try {
      const newMessage = new coupleMessageModel({
        date,
        from,
        to,
        coupleId,
        message: message.message,
        recieved: false,
        type: "text"
      })
      await newMessage.save()
      socket.to(coupleId).emit("message", { type: "file", date, message })
    } catch (error) {
      couple.in(from).emit("not-sent")
    }
  })

  socket.on("file-message", async ({ caption, file, contentType }: FileMessage) => {
    const from = userId
    const to = partnerId
    const { error } = fileMessageSchema.validate({ caption, contentType })
    if (error) {
      couple.in(from).emit("not-sent", error.message)
      return
    }
    const date = new Date()
    const key = from + Date.now() + "." + contentType
    const params = {
      Bucket: "messages",
      Key: key, // File name; to save as in S3
      Body: file,
      ContentType: "image/" + contentType,
    };
    s3.upload(params, async (err: Error, data: ManagedUpload.SendData) => {
      if (err) {
        couple.to(from).emit("not-sent")
        return
      }
      try {
        const newMessage = new coupleMessageModel({
          caption,
          date,
          from,
          to,
          coupleId,
          recieved: false,
          type: "file",
          message: key,
          contentType: "image/" + contentType
        })
        await newMessage.save()
        socket.to(coupleId).emit("message", { type: "file", date, message: key, caption })
      } catch (error) {
        couple.in(from).emit("not-sent")
      }
    })
  })

  socket.on("is-typing", data => {
    couple.to(coupleId).emit("is-typing", data)
  })

})








//Namespace for messages among couple and user
const coupleAndUser = io.of("/couple-and-user")
coupleAndUser.use(async (socket, next) => {
  try {
    const user = await axios.get(`${process.env.GoServer!}/user/session`, { withCredentials: true }) as User
    socket.handshake.auth.user = user
    next()
  } catch (error) {
    next(new Error("Not authorized"))
  }
})

coupleAndUser.on("connection", socket => {
  let room = ""
  const user = socket.handshake.auth.user
  if (user.hasPartner) {
    room = user.couple_id + "_" + socket.handshake.auth.userId
  } else {
    room = socket.handshake.auth.coupleId + "_" + user.id
  }
  socket.join([room, user.id])

  socket.on("text-message", async (message: MessageData) => {
    let from, to
    if (user.hasPartner) {
      from = user.couple_id
      to = socket.handshake.auth.userId
    } else {
      from = socket.handshake.auth.userId
      to = socket.handshake.auth.couple_id
    }

    const { error } = textMessageSchema.validate(message);
    if (error) {
      couple.in(from).emit("not-sent", error.message)
      return
    }

    const date = new Date(Date.now())
    try {
      const newMessage = new groupMessageModel({
        date,
        from,
        to,
        message,
        recieved: false,
        type: "text",
        afrom: user.id
      })
      await newMessage.save()
      couple.to(room).emit("message", { type: "file", date, message })
    } catch (error) {
      couple.in(from).emit("not-sent", error)
    }

  })

  socket.on("file-message", async ({ caption, file, contentType }: FileMessage) => {
    let from: string, to: string
    if (user.hasPartner) {
      from = user.couple_id
      to = socket.handshake.auth.userId
    } else {
      from = socket.handshake.auth.userId
      to = socket.handshake.auth.couple_id
    }
    const { error } = textMessageSchema.validate({ caption, contentType });
    if (error) {
      couple.in(from).emit("not-sent", error.message)
      return
    }

    const date = new Date()
    const key = from + Date.now() + "." + contentType
    const params = {
      Bucket: "messages",
      Key: key, // File name; to save as in S3
      Body: file,
      ContentType: "image/" + contentType,
    };
    s3.upload(params, async (err: Error, data: ManagedUpload.SendData) => {
      if (err) {
        couple.to(from).emit("not-sent", "file-upload")
        return
      }
      try {
        const newMessage = new groupMessageModel({
          caption,
          date,
          from,
          to,
          recieved: false,
          type: "file",
          message: key,
          contentType: "image/" + contentType,
          afrom: user.id
        })
        await newMessage.save()
        couple.to(room).emit("message", { type: "file", date, message: key, caption })
      } catch (error) {
        couple.in(from).emit("not-sent", "something went wrong")
      }
    })
  })

  socket.on("is-typing", data => {
    couple.to(room).emit("is-typing", data)
  })

})

io.adapter(createAdapter(pubClient, subClient));
io.listen(3000)