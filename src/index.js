import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

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
dotenv.config();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
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

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const { limit } = req.query;
  const messagesArray = await messages.find().toArray();

  if (!limit || limit <= 0) {
    res.send(messagesArray);
    return;
  }

  const messagesFilter = messagesArray
    .filter(({ from, to, type }) => {
      const isValidMessage = from === user || to === user || type === "message";
      return isValidMessage;
    })
    .reverse()
    .slice(0, limit);

  res.send(messagesFilter);
});

app.post("/status", async (req, res) => {
  const name = req.headers.user;

  try {
    const user = await participants.findOne({ name });
    if (!user) {
      return res.sendStatus(404);
    }

    const lastStatus = Date.now();
    await participants.updateOne({ name }, { $set: { lastStatus } });
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(404);
  }
});

setInterval(async () => {
  const seconds = Date.now() - 10000;
  try {
    const inactives = await participants
      .find({ lastStatus: { $lte: seconds } })
      .toArray();
    if (inactives.length > 0) {
      const inactiveMessages = inactives.map(({ name }) => {
        const { $H, $m, $s } = dayjs(Date.now());
        const time = `${$H}:${$m}:${$s}`;
        const message = {
          from: name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time,
        };

        return message;
      });

      await messages.insertMany(inactiveMessages);
      await participants.deleteMany({ lastStatus: { $lte: seconds } });
    }
  } catch (error) {
    console.log(error);
  }
}, 15000);

app.listen(5000, () => {
  console.log("server running in port: 5000");
});
