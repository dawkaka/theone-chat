import mongoose from 'mongoose';

const url = new URL(process.env.MONGO_DB!).toString()
mongoose.connect(url)

const Schema = mongoose.Schema;

const CoupleMessages = new Schema<{ from: string, to: string, type: string, message: string, recieved: boolean, date: Date, couple_id: string }>({
    from: String,
    to: String,
    type: String,
    message: String,
    recieved: Boolean,
    date: Date,
    couple_id: String
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