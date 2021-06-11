import express from "express";
import cors from "cors";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { stripHtml } from "string-strip-html";
import dayjs from "dayjs";
import Joi from "joi";

//validation schemas
const newMessageBodySchema = Joi.object({
  to: Joi.string().min(1).required(),
  text: Joi.string().min(1).required(),
  type: Joi.string()
    .regex(/(^message$)|(^private_message$)/)
    .required(),
});
const userSchema = Joi.string().min(1);
//

//Validation functions
function validateUser(userName) {
  let user = userName;
  try {
    user = stripHtml(user).result.trim();
  } catch {
    return {
      value: undefined,
      errorFunction: (res) => res.status(400).send("Invalid input type"),
    };
  }

  const { error: errUser } = userSchema.validate(user);
  if (errUser) {
    return {
      value: undefined,
      errorFunction: (res) => res.status(400).send(`${errUser}`),
    };
  }

  return { value: user, errorFunction: undefined };
}

//"database" access
function getParticipants() {
  return JSON.parse(readFileSync("./data/participants.json")).participants;
}

function setParticipants(participants) {
  writeFileSync("./data/participants.json", JSON.stringify({ participants }));
}

function getMessages() {
  return JSON.parse(readFileSync("./data/messages.json")).messages;
}

function setMessages(messages) {
  writeFileSync("./data/messages.json", JSON.stringify({ messages }));
}
//

//Server initialization
if (!existsSync("./data/participants.json")) {
  setParticipants([]);
}

if (!existsSync("./data/messages.json")) {
  setMessages([]);
}

const app = express();
app.use(cors());
app.use(express.json());
//

//Auto-kick inactive users
setInterval(() => {
  const participants = getParticipants();
  const messages = getMessages();
  const timestamp = Date.now();
  const activeParticipants = participants.filter(
    (p) => timestamp - p.lastStatus < 10000
  );
  const inactiveParticipants = participants.filter(
    (p) => timestamp - p.lastStatus >= 10000
  );
  const time = dayjs(Date.now()).format("HH-mm-ss");
  inactiveParticipants.forEach((participant) => {
    messages.push({
      from: participant.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time,
    });
  });
  setMessages(messages);
  setParticipants(activeParticipants);
}, 15000);

//Allow user to prevent auto-kick
app.post("/status", (req, res) => {
  const { value: user, errorFunction: rejectUser } = validateUser(
    req.headers.user
  );
  if (rejectUser) {
    rejectUser(res);
    return;
  }

  const participants = getParticipants();
  const diskUser = participants.find((u) => u.name === user);
  if (!diskUser) {
    res.status(400).send("User not found");
    return;
  }
  diskUser.lastStatus = Date.now();
  setParticipants(participants);
  res.status(200).send("OK");
});

//Deliver all authorized messages or a limited number of authorized messages to the request source
app.get("/messages", (req, res) => {
  const { value: user, errorFunction: rejectUser } = validateUser(
    req.headers.user
  );
  if (rejectUser) {
    rejectUser(res);
    return;
  }

  const limit = parseInt(req.query.limit, 10);
  const messages = getMessages();
  const filteredMessages = messages.filter((m) => {
    return (
      m.type === "message" ||
      m.type === "status" ||
      m.from === user ||
      m.to === user ||
      m.to === "Todos"
    );
  });

  if (limit > 0) res.status(200).send(filteredMessages.slice(-limit));
  else res.status(200).send(filteredMessages);
});

//Post new message
app.post("/messages", (req, res) => {
  const body = req.body;
  try {
    Object.keys(body).forEach((key) => {
      body[key] = stripHtml(body[key]).result.trim();
    });
  } catch {
    res.status(400).send("Invalid input type");
    return;
  }

  const { error: errBody } = newMessageBodySchema.validate(body);
  if (errBody) {
    res.status(400).send(`${errBody}`);
    return;
  }

  const { value: user, errorFunction: rejectUser } = validateUser(
    req.headers.user
  );
  if (rejectUser) {
    rejectUser(res);
    return;
  }

  const participants = getParticipants();
  if (!participants.find((p) => p.name === user)) {
    res.status(400).send("Sender is not on the list");
    return;
  }

  const messages = getMessages();
  const time = dayjs(Date.now()).format("HH-mm-ss");
  const message = { from: user, time, ...body };
  messages.push(message);
  setMessages(messages);

  res.status(200).send("OK");
});

//Get list of participants
app.get("/participants", (_, res) => {
  const participants = getParticipants();
  res.status(200).send(participants);
});

//Join the room
app.post("/participants", (req, res) => {
  const { value: name, errorFunction: rejectName } = validateUser(
    req.body.name
  );
  if (rejectName) {
    rejectName(res);
    return;
  }

  const participants = getParticipants();
  if (participants.find((p) => p.name === name)) {
    res.status(409).send("Name is already in use");
    return;
  }

  const lastStatus = Date.now();
  participants.push({ name, lastStatus });
  setParticipants(participants);

  const messages = getMessages();
  const time = dayjs(lastStatus).format("HH-mm-ss");
  const message = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time,
  };
  messages.push(message);
  setMessages(messages);

  res.status(200).send("OK");
});

//Fire
app.listen(4000, () => console.log("app is listening to port 4000"));
