import mongoose from 'mongoose';

const url = new URL(process.env.MONGO_DB!).toString()
console.log(url)
mongoose.connect(url)

const Schema = mongoose.Schema;

const CoupleMessages = new Schema({
    from: String,
    to: String,
    type: String,
    message: String,
    recieved: Boolean,
    date: Date,
    caption: String,
    contentType: String,
    coupleId: String
});

export const coupleMessageModel = mongoose.model("couple-message", CoupleMessages)


const GroupMessages = new Schema({
    afrom: String,
    from: String,
    to: String,
    type: String,
    message: String,
    recieved: Boolean,
    date: Date,
    caption: String,
    contentType: String,
})

export const groupMessageModel = mongoose.model("group-message", GroupMessages)