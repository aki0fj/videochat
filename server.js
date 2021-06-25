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

        socket.on(
            "disconnect",
            () =>
            {
                console.log( "disconnect : ", socket.id );
            }
        );

        socket.on(
            "signaling",
            ( objData ) =>
            {
                console.log( "signaling : ", socket.id );
                console.log( "- type : ", objData.type );

                if( "to" in objData )
                {
                    console.log( "- to : ", objData.to );
                    objData.from = socket.id;
                    socket.to( objData.to ).emit( "signaling", objData );
                }
                else
                {
                    console.error( "Unexpected : Unknown destination" );
                }
            }
        );

        socket.on(
            "join",
            ( objData ) =>
            {
                console.log( "join : ", socket.id );
                socket.broadcast.emit( "signaling", { from: socket.id, type: "join" } );
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

