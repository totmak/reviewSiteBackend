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
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "reviewsite-production.up.railway.app:300",
      "Access-Control-Allow-Methods": "GET,POST",
      "Access-Control-Allow-Headers": "basic-header",
      "Access-Control-Allow-Credentials": true
    });
    res.end();
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
