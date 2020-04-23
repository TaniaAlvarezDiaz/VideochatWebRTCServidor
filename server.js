var express = require('express');
var app = express()
var httpServer = require('http').Server(app);

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res) {
  res.sendfile('public/index.html');
});

httpServer.listen(9003, function() {
  console.log('listening on *:9003');
});


var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({ port: 9002 }),
    users = {};

wss.on('connection', function (connection) {
  connection.on('message', function (message) {
    var data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Error parsing JSON");
      data = {};
    }

    switch (data.type) {
      case "login":
        console.log("User logged in as", data.source);
        if (users[data.source]) {
          //username already exists, login not possible
          sendTo(connection, {
            type: "login",
            success: false
          });

        } else {
          users[data.source] = connection;
          connection.source = data.source;
          sendTo(connection, {
            type: "login",
            success: true
          });
        }

        break;
      case "offer":
        console.log("Sending offer to", data.target);
        var conn = users[data.target];

        if (conn != null) {
          connection.target = data.target;
          //send offer to conn
          sendTo(conn, {
            type: "offer",
            offer: data.offer, 
            source: connection.source
          });
        }

        break;
      case "answer":
        console.log("Sending answer to", data.target);
        var conn = users[data.target];

        if (conn != null) {
          connection.target = data.target;
          //send answer to conn
          sendTo(conn, {
            type: "answer",
            answer: data.answer
          });
        }

        break;
      case "candidate":
        console.log("Sending candidate to", data.target);
        var conn = users[data.target];

        if (conn != null) {
          sendTo(conn, {
            type: "candidate",
            candidate: data.candidate
          });
        }

        break;
      case "leave":
        console.log("Disconnecting user from", data.target);
        var conn = users[data.target];
      
        if (conn != null) {
          conn.target = null;
          sendTo(conn, {
            type: "leave"
          });
        }

        break;
      default:
        sendTo(connection, {
          type: "error",
          message: "Unrecognized command: " + data.type
        });

        break;
    }
  });

  connection.on('close', function () {
    if (connection.source) {
      delete users[connection.source];

      if (connection.target) {
        console.log("Disconnecting user from", connection.target);
        var conn = users[connection.target];
        conn.target = null;

        if (conn != null) {
          sendTo(conn, {
            type: "leave"
          });
        }
      }
    }
  });
});

function sendTo(conn, message) {
  conn.send(JSON.stringify(message));
}

wss.on('listening', function () {
    console.log("Server started...");
});