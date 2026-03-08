const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
// Inside server.js
const io = require("socket.io")(server, {
    pingInterval: 25000, // Send a ping every 25 seconds
    pingTimeout: 120000, // Wait up to 2 MINUTES before disconnecting a player (allows for heavy background throttling)
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/mobile.html", (req, res) => {
    res.sendFile(path.join(__dirname, "mobile.html"));
});

// Store rooms and players
const rooms = {};

io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    // Add this inside io.on("connection" in server.js
    socket.on("keepAlivePing", () => {
        // This acknowledges the ping from the Web Worker to keep the connection hot
        // socket.emit("keepAlivePong"); // Optional: send a response back
    });

    // 1. Handle a player joining a room
    socket.on("joinRoom", ({ playerName, roomCode }) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], hostSocket: socket.id }; 
        }

        // PREVENT DUPLICATE ENTRIES
        const nameExists = rooms[roomCode].players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (nameExists) {
            socket.emit("joinError", "Name already taken in this room!");
            return;
        }

        const playerId = rooms[roomCode].players.length;
        if (playerId >= 6) {
            socket.emit("joinError", "Room is full!");
            return;
        }

        const newPlayer = { id: playerId, name: playerName, socketId: socket.id };
        rooms[roomCode].players.push(newPlayer);
        socket.join(roomCode);

        // Store user info on the socket for disconnect handling
        socket.roomCode = roomCode;
        socket.playerId = playerId;

        io.to(roomCode).emit("roomUpdated", rooms[roomCode].players);
        socket.emit("joinedSuccess", newPlayer);
    });

    // 2. Chat Broadcast
    socket.on("sendChat", (data) => {
        io.to(data.roomCode).emit("receiveChat", {
            playerName: data.playerName,
            text: data.text
        });
    });

    // 2. Handle Host starting the game
    socket.on("startGame", (roomCode) => {
        // Send the exact array of joined players to everyone
        io.to(roomCode).emit("gameStarted", rooms[roomCode].players);
    });

    // 3. Media Player Sync (Host Only)
    socket.on("playMedia", (data) => {
        io.to(data.roomCode).emit("syncMedia", data);
    });

    // --- ADD THESE NEW MULTIPLAYER EVENTS ---
    
    // 3. Handle a player rolling the dice
    socket.on("rollDice", ({ roomCode, diceValue, playerId }) => {
        // Broadcast the roll to everyone ELSE in the room
        socket.to(roomCode).emit("diceRolled", { diceValue, playerId });
    });

    // 4. Handle a player moving a piece
    socket.on("movePiece", ({ roomCode, playerId, pieceIndex }) => {
        // Broadcast the movement to everyone ELSE in the room
        socket.to(roomCode).emit("pieceMoved", { playerId, pieceIndex });
    });

    // 4. Handle Disconnect (Leaving Logic Fix)
    socket.on("disconnect", () => {
        console.log("Player disconnected: " + socket.id);
        const roomCode = socket.roomCode;

        if (roomCode && rooms[roomCode]) {
            const room = rooms[roomCode];
            
            // If the HOST left (Host is always playerId 0 or the matching hostSocket)
            if (socket.id === room.hostSocket || socket.playerId === 0) {
                io.to(roomCode).emit("hostLeft"); // Tell everyone the game is over
                delete rooms[roomCode]; // Delete entire room
            } else {
                // Regular player left -> Remove only them
                room.players = room.players.filter(p => p.socketId !== socket.id);
                io.to(roomCode).emit("roomUpdated", room.players);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log("Multiplayer Server running on http://localhost:" + PORT);
});