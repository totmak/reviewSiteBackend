const core = require('@actions/core');
const github = require('@actions/github');
const express = require('express');
const app = express();

require("dotenv").config();

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
//const io = new Server(server);

const PORT = process.env.PORT;

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["CONNECT", "GET", "POST"]
  }
});



app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});



server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});


io.on('connection', (socket) => {
  number++;
  console.log(number);

  socket.on('submit', (msg) => {
    console.log("sasasa")
    console.log(msg);
  });
});

let number = -1;
