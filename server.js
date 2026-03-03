const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server); // Initializes Socket.io
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Store rooms and players
const rooms = {};

io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    // 1. Handle a player joining a room
    socket.on("joinRoom", ({ playerName, roomCode }) => {
        socket.join(roomCode);
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] }; // Create room if it doesn't exist
        }
        
        // Assign player ID (0 for Red, 1 for Green, etc.)
        const playerId = rooms[roomCode].players.length; 
        if(playerId >= 6) {
            socket.emit("roomFull");
            return;
        }

        const playerInfo = { id: playerId, name: playerName, socketId: socket.id };
        rooms[roomCode].players.push(playerInfo);

        // Tell this specific player their ID
        socket.emit("joined", playerInfo);
        
        // Tell everyone in the room to update their lobby list
        io.to(roomCode).emit("updatePlayers", rooms[roomCode].players);
    });

    // 2. Handle Host starting the game
    // 2. Handle Host starting the game
    socket.on("startGame", (roomCode) => {
        // Send the exact array of joined players to everyone
        io.to(roomCode).emit("gameStarted", rooms[roomCode].players);
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

    socket.on("disconnect", () => {
        console.log("Player disconnected: " + socket.id);
        
        // Find which room this socket belonged to
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            
            if (playerIndex !== -1) {
                // Check if the person leaving was the Host (Player 0)
                const isHost = (room.players[playerIndex].id === 0);
                
                // Remove the player from the room's array
                room.players.splice(playerIndex, 1);
                
                // If the room is empty OR the host left, destroy the room entirely!
                if (room.players.length === 0 || isHost) {
                    delete rooms[roomCode];
                    
                    // Tell anyone else still in the room that the game is over
                    io.to(roomCode).emit("roomClosed"); 
                    console.log(`Room ${roomCode} was destroyed because host left or it is empty.`);
                } else {
                    // If a normal player left, just update the lobby list for everyone else
                    io.to(roomCode).emit("updatePlayers", room.players);
                }
                break; // Stop searching once we found and handled the player
            }
        }
    });
});

server.listen(PORT, () => {
    console.log("Multiplayer Server running on http://localhost:" + PORT);
});