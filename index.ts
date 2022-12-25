import { Server } from "socket.io"
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import dotenv from "dotenv";
import axios, { AxiosError } from 'axios';
import { ManagedUpload } from "aws-sdk/clients/s3";
import Joi from "joi"
import express from "express"
import http from "http";

const app = express();
const server = http.createServer(app);

dotenv.config()

import s3 from "./aws";
import { coupleMessageModel, groupMessageModel } from "./models"

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const pubClient = createClient({ url: process.env.REDIS_SERVER });
const subClient = pubClient.duplicate();

interface User {
  has_partner: boolean,
  couple_id: string,
  id: string,
  partner_id: string,
  name: string;
  first_name: string,
  last_name: string
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
      //cookie will be used to get user sessions if it exists (if user is logged in)
      var headers = {
        'Cookie': socket.handshake.headers.cookie || ""
      }
      const user = await axios.get(`${process.env.GO_SERVER!}/user/u/session`, { withCredentials: true, headers: headers }) as { data: { session: User } }
      if (user.data.session.has_partner) {
        socket.handshake.auth.user = user.data.session
        next()
      } else {
        next(new Error("Doesn't have a partner"))
      }
    } catch (error) {
      const err = new Error("Got you");
      next(err);
    }
  }
});

couple.on("connection", socket => {
  const coupleId = socket.handshake.auth.user.couple_id
  const userId = socket.handshake.auth.user.id
  const partnerId = socket.handshake.auth.user.partner_id
  socket.join([coupleId, userId])

  socket.on("text-message", async (message: MessageData) => {
    const from = userId
    const to = partnerId
    const date = new Date()
    try {
      const newMessage = new coupleMessageModel({
        from,
        to,
        type: "text",
        message: message,
        date: new Date(),
        couple_id: coupleId,
        recieved: false,
      })
      const res = await newMessage.save()
      socket.to(coupleId).emit("message", { type: "text", date, message, messageId: res.id, from, to })
      socket.in(from).emit("sent", res.id)

    } catch (error: any) {
      socket.in(from).emit("not-sent", error.message)
    }
  })

  socket.on("file-message", async (file: any) => {
    const from = userId
    const to = partnerId
    const date = new Date()
    const key = from + "_" + Date.now() + ".jpg"
    const params = {
      Bucket: "theone-profile-images",
      Key: key, // File name; to save as in S3
      Body: file,
      ContentType: "image/jpg",
      ACL: "public-read",
    };

    s3.upload(params, async (err: Error, data: ManagedUpload.SendData) => {
      if (err) {
        couple.to(from).emit("not-sent", err)
        return
      }
      try {
        const newMessage = new coupleMessageModel({
          date,
          from,
          to,
          couple_id: coupleId,
          recieved: false,
          type: "file",
          message: key,
        })
        const res = await newMessage.save()
        socket.to(coupleId).emit("message", res)
        socket.in(from).emit("sent", res.id)
      } catch (error) {
        couple.in(from).emit("not-sent", error)
      }
    })
  })

  socket.on("recieved", async () => {
    try {
      const res = await coupleMessageModel.updateMany({ couple_id: coupleId }, { $set: { recieved: true } })
      socket.to(coupleId).emit("recieved")
    } catch (error) {
    }
  })

  socket.on("typing", () => {
    socket.to(coupleId).emit("typing")
  })

  socket.on("not-typing", isTyping => {
    socket.to(coupleId).emit("not-typing")
  })

})



//Namespace for messages among couple and user
const coupleAndUser = io.of("/couple-and-user")
coupleAndUser.use(async (socket, next) => {
  try {
    const user = await axios.get(`${process.env.GO_SERVER!}/user/session`, { withCredentials: true }) as User
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
      const res = await newMessage.save()
      socket.to(room).emit("message", { type: "file", date, message, messageId: res.id })
      socket.in(from).emit("sent", res.id)
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
        const res = await newMessage.save()
        socket.to(room).emit("message", { type: "file", date, message: key, caption, messageId: res.id })
        socket.in(from).emit("sent", res.id)
      } catch (error) {
        couple.in(from).emit("not-sent", "something went wrong")
      }
    })
  })

  socket.on("recieved", async messageId => {
    try {
      await groupMessageModel.findByIdAndUpdate(messageId, { $set: { recieved: true } })
      socket.to(room).emit("recieved", messageId)
    } catch (error) {
    }
  })

  socket.on("typing", isTyping => {
    couple.to(room).emit("typing", isTyping)
  })
})

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  server.listen(4000);
}).catch(error => {
  console.log(error)
});
