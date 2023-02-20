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
  origins: ["ws:reviewsite-production.up.railway.app:3000"],
});

/*
  ws:localhost:3000
  ws:reviewsite-production.up.railway.app:3000
*/

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

const userUpdator = function(){
  console.log("updating sockets...");
  userStatus.list.forEach((item, i) => {
    if (item.isConnected == false){
      item.socket.emit('affirmConnection', true);
      item.isConnected = true;
    }
  });
}

const userStatus = {"list": [], "hasDbConnect": false, "updator": userUpdator}
const databaseList = [
  {"id": "user_accounts",
    "collections": [
      "user_ids", "usernames", "passwords", "forenames", "surnames"
    ]
  },
  {"id": "chats",
    "collections": [
      "groups", "messages"
    ]
  }

]


io.on('connect', (socket, next) => {
  userStatus.list.push({"socket": socket, "isConnected": false, "group": null})
  if (userStatus.list.length > 0){ dbConnection.estabalish(databaseList,userStatus); }
});


io.on('connection', (socket, next) => {
  socket.on("submitRegisterUser", function (msg) {
    const db = dbConnection.getDatabaseById("user_accounts");

    if (db != undefined) {
      db.registerAccount(msg,socket);
    }
  })
  socket.on("submitLoginAttempt", function (msg) {
    const db = dbConnection.getDatabaseById("user_accounts");
    if (db != undefined) {
      db.findLoginStatus(msg, socket);
    };
  })

  socket.on("logout", function (msg) {
    console.log(`User #${msg} has logged out`);
    socket.emit('loginOutConfirm', true);
  })

  socket.on("requestJoiningGroup", function (msg) {
    const db = dbConnection.getDatabaseById("chats");
    if (db != undefined) {
      db.handleGroupJoin(msg, socket);
    };
  })

  socket.on("sendChatMessage", function (msg) {
    const db = dbConnection.getDatabaseById("chats");
    if (db != undefined) {
      db.handleChatMessage(msg, socket);
    };
  })

  socket.once("disconnect", function () {
    const remUserIndex = userStatus.list.findIndex((item, i) => { return item.socket == socket });
    console.log(`User had disconnected`);
    userStatus.list.splice(remUserIndex,1)
    if (userStatus.list.length == 0){ dbConnection.unestabalish(); }
  })
});
