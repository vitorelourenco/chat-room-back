import express from 'express';
import cors from 'cors';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { stripHtml } from 'string-strip-html';
import dayjs from 'dayjs';

function getParticipants(){
  return JSON.parse(readFileSync("./data/participants.json")).participants;
}

function setParticipants(participants){
  writeFileSync("./data/participants.json", JSON.stringify({participants}));
}

function getMessages(){
  return JSON.parse(readFileSync("./data/messages.json")).messages;
}

function setMessages(messages){
  writeFileSync("./data/messages.json", JSON.stringify({messages}));
}

if (!existsSync("./data/participants.json")){
  setParticipants([]);
}

if (!existsSync("./data/messages.json")){
  setMessages([]);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/messages",(req,res)=>{
  const messages = getMessages();
});

app.post("/messages", (req,res)=>{
  const body = req.body;
  const headers = req.headers;

  if (typeof body.to !== "string"){
    res.status(400).send("Invalid input type <to>");
    return;
  }
  if (typeof body.text !== "string"){
    res.status(400).send("Invalid input type <text>");
    return;
  }
  if (typeof body.type !== "string"){
    res.status(400).send("Invalid input type <type>");
    return;
  }
  if (typeof headers.user !== "string"){
    res.status(400).send("Invalid input type <user>");
    return;
  }

  const to = stripHtml(body.to).result.trim();
  const text = stripHtml(body.text).result.trim();
  const type = stripHtml(body.type).result.trim();
  const user = stripHtml(headers.user).result.trim();

  if (!(type==="message"||type==="private_message")){
    res.status(400).send("Invalid input message <type>");
    return;   
  }

  const participants = getParticipants();
  if (participants.indexOf(user) === -1){
    res.status(400).send("Sender is not on the list");
    return;   
  }

  const messages = getMessages();
  const time = dayjs(Date.now()).format("HH-mm-ss");
  const message = {from: user, to, text, type, time}
  messages.push(message);
  setMessages(messages);

  res.status(200).send("OK");
})

app.get("/participants",(req,res)=>{
  const participants = getParticipants();
  res.status(200).send(participants);
});

app.post("/participants",(req,res)=>{
  const body = req.body;
  if (typeof body.name !== "string"){
    res.status(400).send("Invalid input type");
    return;
  }

  const name = stripHtml(body.name).result.trim();
  if (name === "") {
    res.status(400).send("Name is empty");
    return;
  }

  const participants = getParticipants();
  if (participants.indexOf(name) !== -1){
    res.status(409).send("Name is already in use");
    return;
  } 

  const lastStatus = Date.now();
  participants.push({name, lastStatus});
  setParticipants(participants);

  const messages = getMessages();
  const time = dayjs(lastStatus).format("HH-mm-ss");
  const message = {from: name, to:"Todos", text:"entra na sala...", type:"status", time}
  messages.push(message);
  setMessages(messages);

  res.status(200).send("OK");
});

app.listen(4000, ()=>console.log('app is listening to port 4000'));