"use strict"; 

// Modules
const express = require( "express" );
const https = require( "https" );
const socketIO = require( "socket.io" );
const fs = require("fs");

// Objects
const app = express();
const server = https.Server({
    key: fs.readFileSync("./ssl_keys/private.pem"),
    cert: fs.readFileSync("./ssl_keys/cert.pem"),
}, app );
const io = socketIO( server );

// Constants
const PORT = process.env.PORT || 1337;

// socket connection
io.on(
    "connection",
    ( socket ) =>
    {
        console.log( "connection : ", socket.id );

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では"disconnect"イベントが発生する
        socket.on(
            "disconnect",
            () =>
            {
                console.log( "disconnect : ", socket.id );
            }
        );
        // signalingデータ受信時の処理
        // ・クライアント側のsignalingデータ送信「socket.emit( "signaling", objData );」に対する処理
        socket.on(
            "signaling",
            ( objData ) =>
            {
                console.log( "signaling : ", socket.id );
                console.log( "- type : ", objData.type );

                // 送信元以外の全員に送信
                socket.broadcast.emit( "signaling", objData );
            }
        );
    }
);

// set public folder
app.use( express.static( __dirname + "/public" ) );

// Start Server
server.listen(
    PORT,
    '0.0.0.0',
    () =>
    {
        console.log( "Server on port %d", PORT );
    }
);

