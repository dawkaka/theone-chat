import mongoose from 'mongoose';
import { SchemaTextFieldPhonetics } from "redis";

mongoose.connect("mongodb://127.0.0.1:27017/test")

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