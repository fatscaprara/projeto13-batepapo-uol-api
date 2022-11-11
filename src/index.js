import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();

app.listen(5000, () => {
  console.log("server running in port: 5000");
});
