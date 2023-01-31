const core = require('@actions/core');
const github = require('@actions/github');
const express = require('express');
const app = express();

require("dotenv").config();

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const dbConnection = require('./database.js').estCon;

const PORT = process.env.PORT;
const io = require("socket.io")(server, {
  cors: {
    origin: "https://reviewsite-production.up.railway.app:3000",
    methods: ["CONNECT", "GET", "POST"],
    credentials: true
  }
});



app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});



server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});


const userStatus = {"count": 0, "hasDbConnect": false}
const databaseList = [
  {"id": "user_accounts",
    "collections": [
      "user_ids", "usernames", "passwords", "forenames", "surnames"
    ]
  }
]


io.on('connect', (socket, next) => {
  userStatus.count++;
  if (userStatus.count == 1){ dbConnection.estabalish(databaseList); }
});


io.on('connection', (socket, next) => {

  socket.on("submitRegisterUser", function (msg) {
    const db = dbConnection.getDatabaseById("user_accounts");

    if (db != undefined) {
      db.registerAccount(msg);
      socket.emit("testo", "xa");
    }
  })
  socket.on("submitLoginAttempt", function (msg) {
    const db = dbConnection.getDatabaseById("user_accounts");
    if (db != undefined) {
      db.findLoginStatus(msg, socket);
    };
  })


  socket.once("disconnect", function () {
    userStatus.count--;
    if (userStatus.count == 0){ dbConnection.unestabalish(); }
  })
});
