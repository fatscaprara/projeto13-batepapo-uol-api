import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";

const nameSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi
    .string()
    .required()
    .pattern(/^private_message$|^message$/),
});

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;
let participants;
let messages;

try {
  await mongoClient.connect();
  db = mongoClient.db("bate_papo_uol");
  participants = db.collection("participants");
  messages = db.collection("messages");
} catch (error) {
  console.log(error);
}

app.post("/participants", async (req, res) => {
  const body = req.body;

  const validation = nameSchema.validate(body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map(({ message }) => message);
    res.status(422).send(errors);
    return;
  }

  try {
    const user = await participants.findOne({ name: body.name });
    if (user) {
      res.sendStatus(409);
      return;
    }

    const lastStatus = Date.now();
    await participants.insertOne({
      name: body.name,
      lastStatus,
    });

    const { $H, $m, $s } = dayjs(lastStatus);
    const time = `${$H}:${$m}:${$s}`;
    await messages.insertOne({
      from: body.name,
      to: "Todos",
      text: "Entra na sala...",
      type: "status",
      time,
    });

    res.sendStatus(201);
  } catch (error) {
    res.send(error);
  }
});

app.get("/participants", async (req, res) => {
  const participantsArray = await participants.find().toArray();

  res.send(participantsArray);
});

app.post("/messages", async (req, res) => {
  const body = req.body;
  const remetent = req.headers.user;

  const validation = messageSchema.validate(body, { abortEarly: false });
  if (validation.error) {
    const errors = validation.error.details.map(({ message }) => message);
    res.status(422).send(errors);
    return;
  }
  try {
    const hasNameInList = await participants.findOne({ name: remetent });
    if (!hasNameInList) {
      res.sendStatus(422);
      return;
    }
    const { $H, $m, $s } = dayjs(Date.now());
    const time = `${$H}:${$m}:${$s}`;
    const { to, text, type } = body;
    const message = {
      from: remetent,
      to,
      text,
      type,
      time,
    };
    await messages.insertOne(message);
    res.send(201);
  } catch (error) {
    res.sendStatus(422);
  }
});

app.listen(5000, () => {
  console.log("server running in port: 5000");
});
