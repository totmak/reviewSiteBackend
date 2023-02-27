const core = require('@actions/core');
const github = require('@actions/github');
const express = require('express');
const app = express();
const randtoken = require('rand-token');
require("dotenv").config();

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const dbConnection = require('./database.js').estCon;

const PORT = process.env.PORT;
const encryptor = require('simple-encryptor')(process.env.KEY);



const io = require("socket.io")(server, {
  origins: [process.env.URL],
});


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
      item.socket.emit('affirmConnection', encryptor.encrypt(true));
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
      db.registerAccount(encryptor.decrypt(msg),socket);
    }
  })
  socket.on("submitLoginAttempt", function (msg) {
    const db = dbConnection.getDatabaseById("user_accounts");
    if (db != undefined) {
      db.findLoginStatus(encryptor.decrypt(msg), socket);
    };
  })

  socket.on("logout", function (msg) {
    const us = encryptor.decrypt(msg);
    console.log(`User #${us} has logged out`);
    socket.emit('loginOutConfirm', encryptor.encrypt(true));
  })

  socket.on("requestJoiningGroup", function (msg) {
    const db = dbConnection.getDatabaseById("chats");
    if (db != undefined) {
      db.handleGroupJoin(encryptor.decrypt(msg), socket);
    };
  })

  socket.on("sendChatMessage", function (msg) {
    const db = dbConnection.getDatabaseById("chats");
    if (db != undefined) {
      db.handleChatMessage(encryptor.decrypt(msg), socket);
    };
  })

  socket.once("disconnect", function () {
    console.log(`User had disconnected`);
    const ind = userStatus.list.findIndex((item, i) => {
      return socket == item.socker;
    });
    if (ind != -1){
      userStatus.list.splice(ind,1);
    }

    if (userStatus.list.length == 0){ dbConnection.unestabalish(); }
  })
});
