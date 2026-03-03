class LudoGame extends Phaser.Scene {

    constructor() {
        super("LudoGame");
        
    }
    
    create() {

        window.gameScene = this;
        // 🔥 NEW CHEAT STATES
        this.cheatTPActive = false;
        this.cheatTPType = null; // 'tile' or 'win'
        // --- WIN11 MICA LAYER ---
        // Creates a frosted pane behind the tiles
        this.add.rectangle(600, 600, 850, 850, 0x1a1a1a, 0.6)
            .setStrokeStyle(2, 0xffffff, 0.1)
            .setDepth(-1);

        this.centerX = 600;
        this.centerY = 600;
        this.tileSize = 38; // Slightly larger for better spacing

        this.colors = [
            { name: "RED", value: 0xff0000 },
            { name: "GREEN", value: 0x00c853 },
            { name: "ORANGE", value: 0xff6f00 },
            { name: "CYAN", value: 0x00bcd4 },
            { name: "YELLOW", value: 0xffeb3b },
            { name: "PURPLE", value: 0x9c27b0 }
        ];

        this.players = [];
        this.currentPlayerIndex = 0;
        this.diceValue = 0;
        this.isMoving = false;

        this.globalOuterPath = [];
        this.middleLanes = [];

        this.buildEnclosures();
        this.buildGlobalOuterRing();

        // 🔥 detect real circular start index for each player
        this.startIndices = [];

        for (let p = 0; p < 6; p++) {

            // find the tile that has row=1,col=1 (star tile)
            let starTile = this.children.list.find(
                t => t.player === p && t.row === 1 && t.col === 1
            );

            // now find its index in sorted outer ring
            let index = this.globalOuterPath.indexOf(starTile);

            this.startIndices[p] = index;
        }

        this.drawWinZones();
        this.drawHomeWings();
        this.createHomeCircles();
        this.createPlayers();
        this.updateTurnUI();
        this.finishedRanks = []; // Tracks who won 1st, 2nd, etc.
        this.updateScoreboard(); // Initialize UI
    }

    // -------------------- BOARD --------------------

    buildEnclosures() {

        for (let p = 0; p < 6; p++) {

            let angle = Phaser.Math.DegToRad(60 * p);
            let base = this.rotate(0, -300, angle);

            for (let row = -1; row <= 1; row++) {
                for (let col = 0; col < 6; col++) {

                    let localX = row * this.tileSize;
                    let localY = col * this.tileSize;

                    let rotated = this.rotate(localX, localY, angle);

                    let x = this.centerX + base.x + rotated.x;
                    let y = this.centerY + base.y + rotated.y;

                    let color = 0xffffff;

                    if (row === 1 && col === 1)
                        color = this.colors[p].value;

                    if (row === 0 && col > 0)
                        color = this.colors[p].value;

                    let tile = this.add.rectangle(
                        x, y,
                        this.tileSize - 4, // creates a clean grid gap
                        this.tileSize - 4,
                        color
                    )
                    .setStrokeStyle(1, 0xffffff, 0.05)
                    .setAngle(60 * p);

                    // Set Mica-style transparency for white tiles
                    if (color === 0xffffff) {
                        tile.setAlpha(0.7);
                    } else {
                        tile.setAlpha(0.85); // Colored tiles are more solid
                    }

                    tile.player = p;
                    tile.row = row;
                    tile.col = col;

                    // --- ARROW & STAR LOGIC ---
                    if (row === 1 && col === 1){
                        this.drawStar(x, y, angle, 0xffd700, 0.85); // Entrance Star
                        tile.isStar = true; // <-- ADD THIS
                    }
                    // REPLACE STAR WITH REVERSED FLUSH ARROW
                    if (row === -1 && col === 2){
                        this.drawStar(x, y, angle, 0x000000, 0.0); // Safe Star
                        tile.isStar = true; // <-- ADD THIS
                    }
                    if (row === 0 && col === 0)
                        this.drawArrow(x, y, angle, this.colors[p].value); // Directional Arrow
                    // --------------------------

                    if (row === 0) {
                        if (!this.middleLanes[p]) this.middleLanes[p] = [];
                        this.middleLanes[p][col] = tile;
                    }
                }
            }
        }
    }

    buildGlobalOuterRing() {
        this.globalOuterPath = [];
        let outerTiles = [];

        // Collect ALL outer tiles PLUS the bridge/entrance tile (row 0, col 0)
        this.children.list.forEach(obj => {
            if (obj.row === 1 || obj.row === -1 || (obj.row === 0 && obj.col === 0)) {
                outerTiles.push(obj);
            }
        });

        // Sort by angle around center (clockwise)
        outerTiles.sort((a, b) => {
            let angleA = Math.atan2(a.y - this.centerY, a.x - this.centerX);
            let angleB = Math.atan2(b.y - this.centerY, b.x - this.centerX);
            return angleA - angleB;
        });

        this.globalOuterPath = outerTiles;
    }

    // --- FIX WIN ZONES (Small flush triangles with black borders) ---
    // --- UPDATED WIN ZONES (Larger size, 1px border) ---
    drawWinZones() {
        const outerRadius = 105; 
        this.winPoints = [];
        this.victoryCrowns = []; // Array to store the crown objects

        for (let i = 0; i < 6; i++) {
            let g = this.add.graphics();
            g.fillStyle(this.colors[i].value, 0.9);
            g.lineStyle(3.5, 0x000000, 0.8);

            let baseAngle = Phaser.Math.DegToRad(60 * i);
            let startAngle = baseAngle - Phaser.Math.DegToRad(30);
            let endAngle = baseAngle + Phaser.Math.DegToRad(30);

            let p1 = { x: 0, y: 0 };
            let p2 = this.rotate(0, -outerRadius, startAngle);
            let p3 = this.rotate(0, -outerRadius, endAngle);

            g.beginPath();
            g.moveTo(this.centerX + p1.x, this.centerY + p1.y);
            g.lineTo(this.centerX + p2.x, this.centerY + p2.y);
            g.lineTo(this.centerX + p3.x, this.centerY + p3.y);
            g.closePath();
            g.fillPath();
            g.strokePath();
            
            // Landing spot calculation
            let winX = this.centerX + Math.sin(baseAngle) * (outerRadius * 0.5);
            let winY = this.centerY - Math.cos(baseAngle) * (outerRadius * 0.5);
            
            this.winPoints[i] = { x: winX, y: winY };

            // Create the crown but keep it HIDDEN (alpha = 0)
            let crown = this.drawCrown(winX, winY, baseAngle);
            crown.setAlpha(0); 
            this.victoryCrowns[i] = crown;
        }
    }

    // -------------------- HOME --------------------

    createHomeCircles() {

        this.homeCircles = [];

        const r = 50;
        const d = 240;

        for (let i = 0; i < 6; i++) {

            let angle = Phaser.Math.DegToRad(60 * i + 30);
            let base = this.rotate(0, -d, angle);

            let x = this.centerX + base.x;
            let y = this.centerY + base.y;

            this.add.circle(x, y, r, 0xffffff)
                .setStrokeStyle(4, 0x000000);

            this.homeCircles.push({ x, y, radius: r });
        }
    }

    drawHomeWings() {
        for (let i = 0; i < 6; i++) {
            // Create graphics object and set depth to be behind everything else
            let g = this.add.graphics().setDepth(-0.5); 
            
            let playerColor = this.colors[i].value;
            
            // Fill with player color (slightly transparent for that 'glass' look)
            // Stroke with a bold black border as per your drawing
            g.fillStyle(playerColor, 1); 
            g.lineStyle(3, 0x000000, 1); 

            // Angle points to the gap between lanes (30, 90, 150, etc.)
            let angle = Phaser.Math.DegToRad(60 * i + 30); 
            
            // Define Triangle Points (Adjust radii to change how far they stretch)
            let tip = this.rotate(0, -116, angle);         // Tip near the board center
            let leftBase = this.rotate(-109, -304, angle);  // Outer left corner
            let rightBase = this.rotate(109, -304, angle); // Outer right corner
            
            g.beginPath();
            g.moveTo(this.centerX + tip.x, this.centerY + tip.y);
            g.lineTo(this.centerX + leftBase.x, this.centerY + leftBase.y);
            g.lineTo(this.centerX + rightBase.x, this.centerY + rightBase.y);
            g.closePath();
            
            g.fillPath();
            g.strokePath();
        }
    }

    createPlayers() {
        // Create an array of IDs representing who actually joined
        let activeIds = window.activePlayers ? window.activePlayers.map(p => p.id) : [0, 1, 2, 3, 4, 5];

        for (let i = 0; i < 6; i++) {
            // CRITICAL: If this player ID did not join, skip spawning their gutis!
            if (!activeIds.includes(i)) continue;

            let playerName = this.colors[i].name;
            if (window.activePlayers) {
                let joinedPlayer = window.activePlayers.find(p => p.id === i);
                if (joinedPlayer) playerName = joinedPlayer.name;
            } else if (window.playerNames) {
                playerName = window.playerNames[i];
            }

            let player = { 
                id: i, 
                name: playerName,
                pieces: [] 
            };
            
            let home = this.homeCircles[i];
            const spread = home.radius * 0.45;

            [45, 135, 225, 315].forEach(deg => {
                let rad = Phaser.Math.DegToRad(deg);
                let piece = this.add.circle(
                    home.x + Math.cos(rad) * spread,
                    home.y + Math.sin(rad) * spread,
                    11, 
                    this.colors[i].value
                )
                .setStrokeStyle(2, 0x000000, 1) 
                .setDepth(2000);

                piece.homeX = piece.x;
                piece.homeY = piece.y;
                piece.playerId = i;
                piece.pathIndex = -1;
                piece.lapCount = 0;
                piece.tilesMoved = 0; 
                piece.inMiddle = false;
                piece.middleIndex = -1;
                piece.isFinished = false;

                piece.setInteractive();
                piece.on("pointerdown", () => this.tryMove(piece));
                player.pieces.push(piece);
            });
            
            // Only active players get pushed to this.players array
            this.players.push(player);
        }
    }

    // -------------------- DICE --------------------

    // --- MULTIPLAYER DICE LOGIC ---
    rollFromUI() {
        // ⛔ Prevent rolling if it's not your turn
        if (window.myPlayerId !== this.currentPlayerIndex) {
            console.log("It is not your turn!");
            return;
        }

        if (this.isMoving || this.diceValue > 0) return;

        // Generate the roll
        let val = Phaser.Math.Between(1, 6);
        
        // 📡 Send the roll to the server so other players see it
        window.socket.emit("rollDice", {
            roomCode: window.myRoomCode,
            diceValue: val,
            playerId: window.myPlayerId
        });

        // Process the roll locally
        this.processDiceRoll(val);
    }

    // Handles the actual dice logic for both the roller and the receivers
    processDiceRoll(val) {
        this.diceValue = val;
        document.getElementById("diceDisplay").innerText = "🎲 " + this.diceValue;

        let player = this.players[this.currentPlayerIndex];
        
        let canMove = player.pieces.some(piece => {
            if (piece.pathIndex === -1) return this.diceValue === 6;
            if (piece.inMiddle) return (piece.middleIndex + this.diceValue < this.middleLanes[player.id].length);
            return true;
        });

        // Auto-skip turn if no moves are possible
        if (!canMove) {
            this.time.delayedCall(1000, () => {
                this.diceValue = 0;
                document.getElementById("diceDisplay").innerText = "🎲 -";
                this.nextTurn();
            });
        }
    }

    // Called when the server tells us another player rolled
    receiveDiceRoll(val) {
        this.processDiceRoll(val);
    }

    // Handles the actual dice logic for both the roller and the receivers
    processDiceRoll(val) {
        this.diceValue = val;
        document.getElementById("diceDisplay").innerText = "🎲 " + this.diceValue;

        let player = this.players[this.currentPlayerIndex];
        
        let canMove = player.pieces.some(piece => {
            if (piece.pathIndex === -1) return this.diceValue === 6;
            if (piece.inMiddle) return (piece.middleIndex + this.diceValue < this.middleLanes[player.id].length);
            return true;
        });

        // Auto-skip turn if no moves are possible
        if (!canMove) {
            this.time.delayedCall(1000, () => {
                this.diceValue = 0;
                document.getElementById("diceDisplay").innerText = "🎲 -";
                this.nextTurn();
            });
        }
    }

    // Called when the server tells us another player rolled
    receiveDiceRoll(val) {
        this.processDiceRoll(val);
    }

    // -------------------- MOVEMENT --------------------

    // --- UPDATED MOVEMENT LOGIC ---
    // --- UPDATED TRYMOVE (Ensures it sits in winzone) ---
    // --- UPDATED TRYMOVE (Cheating Prevention) ---
    // --- UPDATED TRYMOVE (Fix Lane Entry) ---
    async tryMove(piece, isRemote = false) {
        let player = this.players[this.currentPlayerIndex];
        
        // --- 1. BASIC CHECKS (Applies to both local and remote) ---
        if (this.diceValue === 0 || this.isMoving || piece.isFinished) return;
        if (piece.playerId !== player.id) return;

        // --- 2. IS THE MOVE PHYSICALLY POSSIBLE? ---
        let rolledSix = (this.diceValue === 6);
        if (piece.pathIndex === -1 && !rolledSix) return; // Can't leave base without a 6
        if (piece.inMiddle && (piece.middleIndex + this.diceValue >= this.middleLanes[player.id].length)) return; // Can't overshoot win zone

        // --- 3. MULTIPLAYER BROADCAST (Only send if the move is actually valid!) ---
        if (!isRemote) {
            if (window.myPlayerId !== this.currentPlayerIndex) {
                console.log("Not your turn!");
                return;
            }
            if (piece.playerId !== window.myPlayerId) {
                console.log("You can only move your own pieces!");
                return;
            }

            // Move is 100% valid. Tell everyone else!
            let pieceIndex = player.pieces.indexOf(piece);
            window.socket.emit("movePiece", {
                roomCode: window.myRoomCode,
                playerId: window.myPlayerId,
                pieceIndex: pieceIndex
            });
        }
        // 🔥 CHECK IF TELEPORT CHEAT IS ACTIVE
        if (this.cheatTPActive) {
            this.cheatTPActive = false; // Reset the switch
            
            if (this.cheatTPType === 'win') {
                // Instant Win Teleport
                await this.animateTo(piece, this.winPoints[player.id]);
                piece.isFinished = true;
                piece.inMiddle = false;
                piece.disableInteractive();
            } else {
                // Specific Tile Teleport
                let targetIdx = parseInt(document.getElementById('tp-index').value) || 0;
                piece.pathIndex = targetIdx % this.globalOuterPath.length;
                piece.tilesMoved = 20; // Set to a high number so it can enter the home lane later
                piece.inMiddle = false;
                await this.animateTo(piece, this.globalOuterPath[piece.pathIndex]);
            }

            this.arrangePieces();
            // --- THE FIX ---
            this.isMoving = false; // Unblock the game
            this.diceValue = 0;    // Clear the "used" dice
            this.nextTurn();       // Move to next player
            return;
        }

        // --- REGULAR MOVE LOGIC STARTS HERE ---
        if (this.diceValue === 0 || this.isMoving || piece.isFinished) return;
        if (piece.playerId !== player.id) return;

        let steps = this.diceValue;
        let reachedWinZone = false; // Track if this guti finishes

        if (piece.pathIndex === -1) {
            if (steps !== 6) return; 
            this.diceValue = 0;
            document.getElementById("diceDisplay").innerText = "🎲 -";
            piece.pathIndex = this.startIndices[player.id];
            piece.tilesMoved = 0; 
            
            await this.animateTo(piece, this.globalOuterPath[piece.pathIndex]);
            this.arrangePieces(); 

            if (!rolledSix) this.nextTurn();
            return;
        }

        if (piece.inMiddle) {
            let remaining = 6 - piece.middleIndex;
            if (steps > remaining) return; 
        }

        this.diceValue = 0;
        document.getElementById("diceDisplay").innerText = "🎲 -";

        while (steps > 0) {
            if (!piece.inMiddle) {
                let currentTile = this.globalOuterPath[piece.pathIndex];

                if (piece.tilesMoved >= 50 && currentTile.row === 0 && currentTile.col === 0 && currentTile.player === player.id) {
                    piece.inMiddle = true;
                    piece.middleIndex = 1; 
                    await this.animateTo(piece, this.middleLanes[player.id][piece.middleIndex]);
                } else {
                    piece.pathIndex = (piece.pathIndex + 1) % this.globalOuterPath.length;
                    piece.tilesMoved++; 
                    await this.animateTo(piece, this.globalOuterPath[piece.pathIndex]);
                }
            } else {
                piece.middleIndex++;
                if (piece.middleIndex === 6) {
                    await this.animateTo(piece, this.winPoints[player.id]);
                    piece.isFinished = true;
                    // STANDARD STACKING LOGIC: Shrink the gutis and put them in a mini-grid
                    let finishedList = player.pieces.filter(p => p.isFinished);
                    let indexInHome = finishedList.indexOf(piece);
                    
                    // 1. Scale the piece down (This is how normal tiles fit multiple gutis!)
                    piece.setScale(0.65); // Shrinks it to 65% of its normal size

                    // 2. Define the exact corners for the stack
                    const winOffsets = [
                        { x: -10, y: -10 }, // 1st: Top-Left
                        { x: 10, y: -10 },  // 2nd: Top-Right
                        { x: -10, y: 10 },  // 3rd: Bottom-Left
                        { x: 10, y: 10 }    // 4th: Bottom-Right
                    ];
                    
                    // 3. Apply the shift and bring them to the front
                    if (indexInHome !== -1 && indexInHome < 4) {
                        piece.x += winOffsets[indexInHome].x;
                        piece.y += winOffsets[indexInHome].y;
                        piece.setDepth(100 + indexInHome); 
                    }
                    piece.disableInteractive();
                    reachedWinZone = true; // 🔥 Set flag for extra turn

                    // 🔥 CHECK FOR VICTORY (4 pieces finished)
                    let finishedCount = player.pieces.filter(p => p.isFinished).length;
                    if (finishedCount === 4) {
                        // Register their rank if not already registered
                        if (!this.finishedRanks.includes(player.id)) {
                            this.finishedRanks.push(player.id);
                        }
                        this.tweens.add({
                            targets: this.victoryCrowns[player.id],
                            alpha: 1,
                            scale: 1.5, // Make it pop!
                            yoyo: true,
                            hold: 500,
                            duration: 1000,
                            ease: "Back.easeOut",
                            onComplete: () => {
                                this.victoryCrowns[player.id].setAlpha(1).setScale(1.2);
                            }
                        });
                        console.log(player.name + " HAS WON!");
                    }

                    steps = 0; 
                    break;
                } else {
                    await this.animateTo(piece, this.middleLanes[player.id][piece.middleIndex]);
                }
            }
            steps--;
        }

        let wasCapture = await this.handleCapture(piece);
        this.arrangePieces();

        // 🔥 Updated Turn Logic: Extra turn if 6, Capture, OR reaching Win Zone
        if (!rolledSix && !wasCapture && !reachedWinZone) {
            this.nextTurn();
        } else {
            console.log("Extra Turn Granted!");
            this.updateScoreboard();
        }
    }

    // Called when the server tells us another player moved a piece
    // Called when the server tells us another player moved a piece
    receivePieceMove(playerId, pieceIndex) {
        // 🚨 FORCE SYNC: Ensure the local game knows it is this player's turn!
        this.currentPlayerIndex = playerId;
        this.updateTurnUI();

        let pieceToMove = this.players[playerId].pieces[pieceIndex];
        // Trigger the move, passing 'true' so it bypasses local security
        this.tryMove(pieceToMove, true); 
    }

    async handleCapture(movingPiece) {
        if (movingPiece.inMiddle) return false;

        let currentTile = this.globalOuterPath[movingPiece.pathIndex];
        
        // Safe zone - no killing allowed
        if (currentTile && currentTile.isStar) return false;

        let capturedAny = false;

        // Loop through other players
        for (let player of this.players) {
            if (player.id === movingPiece.playerId) continue;

            // Find ALL pieces belonging to this opponent on the same tile
            let victims = player.pieces.filter(p => 
                !p.inMiddle && 
                p.pathIndex === movingPiece.pathIndex && 
                !p.isFinished && 
                p.pathIndex !== -1
            );

            for (let victim of victims) {
                capturedAny = true;
                
                // Reset the victim's progress instantly so arrangePieces ignores it
                victim.pathIndex = -1;
                victim.tilesMoved = 0;
                victim.lapCount = 0;

                // Animate victim back home
                this.tweens.add({
                    targets: victim,
                    x: victim.homeX,
                    y: victim.homeY,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 500,
                    ease: "Back.easeOut"
                });
            }
        }

        // Wait a half-second for the kill animation so it feels impactful
        if (capturedAny) {
            await new Promise(resolve => this.time.delayedCall(500, resolve));
        }

        return capturedAny;
    }

    animateTo(piece, tile) {
        this.isMoving = true;

        // Calculate angle to the tile
        let angleToTile = Math.atan2(tile.y - piece.y, tile.x - piece.x);

        return new Promise(resolve => {
            this.tweens.add({
                targets: piece,
                x: tile.x,
                y: tile.y,
                // Rotate the piece towards the destination
                angle: Phaser.Math.RadToDeg(angleToTile) + 90, 
                duration: 170,
                ease: "Back.easeOut",
                onComplete: () => {
                    this.time.delayedCall(70, () => {
                        this.isMoving = false;
                        resolve();
                    });
                }
            });
        });
    }
    arrangePieces() {
        let tileMap = {};

        this.players.forEach(player => {
            player.pieces.forEach(piece => {
                // Now we ONLY ignore pieces that are still in the home base
                if (piece.pathIndex === -1) return; 

                let key;
                if (piece.isFinished) {
                    // Create a unique stacking key for each player's finish zone
                    key = `win_${player.id}`;
                } else {
                    key = piece.inMiddle 
                        ? `middle_${player.id}_${piece.middleIndex}` 
                        : `outer_${piece.pathIndex}`;
                }
                
                if (!tileMap[key]) tileMap[key] = [];
                tileMap[key].push(piece);
            });
        });

        for (let key in tileMap) {
            let pieces = tileMap[key];
            let count = pieces.length;

            pieces.forEach((piece, index) => {
                let targetX, targetY;
                let targetScale = 0.85;

                // Determine base coordinates
                if (piece.isFinished) {
                    targetX = this.winPoints[piece.playerId].x;
                    targetY = this.winPoints[piece.playerId].y;
                } else {
                    let tile = piece.inMiddle 
                        ? this.middleLanes[piece.playerId][piece.middleIndex] 
                        : this.globalOuterPath[piece.pathIndex];
                    targetX = tile.x;
                    targetY = tile.y;
                }

                // 🔥 Stacking Logic
                const isWinZone = piece.isFinished;
                const isStar = !isWinZone && !piece.inMiddle && this.globalOuterPath[piece.pathIndex].isStar;
                const isSameColor = pieces.every(p => p.playerId === pieces[0].playerId);

                // Spread out if in Win Zone, on a Star, or if they are the same color
                if (count > 1 && (isWinZone || isStar || isSameColor || piece.inMiddle)) {
                    targetScale = 0.55; // Slightly smaller to fit better
                    let spread = isWinZone ? 15 : 10; // Wider spread for the large win triangles
                    
                    let angle = (index / count) * Math.PI * 2;
                    targetX += Math.cos(angle) * spread;
                    targetY += Math.sin(angle) * spread;
                }

                this.tweens.add({
                    targets: piece,
                    x: targetX,
                    y: targetY,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    duration: 250,
                    ease: "Back.easeOut"
                });
            });
        }
    }

    // --------------------

    nextTurn() {
        // Calculate total active players (fallback to 6 if offline)
        let totalActive = window.activePlayerIds ? window.activePlayerIds.length : 6;
        
        if (this.finishedRanks.length >= totalActive - 1) {
            document.getElementById("turnDisplay").innerText = "GAME OVER";
            return; // End game if all but one player has finished
        }
        
        // Loop to find the next player who HAS NOT finished AND is IN THE ROOM
        let loopSafeguard = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 6;
            loopSafeguard++;
        } while (
            loopSafeguard < 10 && 
            (this.finishedRanks.includes(this.currentPlayerIndex) || 
            (window.activePlayerIds && !window.activePlayerIds.includes(this.currentPlayerIndex)))
        );

        this.updateTurnUI();
    }

    updateTurnUI() {
        const playerColor = this.colors[this.currentPlayerIndex];
        const turnText = document.getElementById("turnDisplay");
        const rollBtn = document.getElementById("rollBtn");

        // Show whose turn it is
        turnText.innerText = playerColor.name + "'S TURN";

        // Hide or show the roll button based on multiplayer ID
        if (window.myPlayerId === this.currentPlayerIndex) {
            rollBtn.style.display = "block"; // Show button
            turnText.innerText += " (YOU)";
        } else {
            rollBtn.style.display = "none";  // Hide button
        }
        
        // Update Button Color Dynamically to match the player!
        rollBtn.style.background = `linear-gradient(135deg, ${this.formatHex(playerColor.value)} 0%, #222 150%)`;
        rollBtn.style.boxShadow = `0 10px 20px ${this.formatHex(playerColor.value)}44`;
    }

    updateScoreboard() {
        const scoreboardDiv = document.getElementById("scoreboard");
        if (!scoreboardDiv) return;

        // NEW: Auto-detect winners to guarantee ranks show up!
        this.players.forEach(player => {
            let finishedCount = player.pieces.filter(p => p.isFinished).length;
            if (finishedCount === 4 && !this.finishedRanks.includes(player.id)) {
                this.finishedRanks.push(player.id);
            }
        });

        // Sort players based on winning rank, then pieces finished, then tiles moved
        let sortedPlayers = [...this.players].sort((a, b) => {
            let rankA = this.finishedRanks.indexOf(a.id);
            let rankB = this.finishedRanks.indexOf(b.id);
            
            if (rankA !== -1 && rankB !== -1) return rankA - rankB; 
            if (rankA !== -1) return -1; 
            if (rankB !== -1) return 1;  
            
            let aFinished = a.pieces.filter(p => p.isFinished).length;
            let bFinished = b.pieces.filter(p => p.isFinished).length;
            if (bFinished !== aFinished) return bFinished - aFinished;
            
            let aMoved = a.pieces.reduce((sum, p) => sum + p.tilesMoved, 0);
            let bMoved = b.pieces.reduce((sum, p) => sum + p.tilesMoved, 0);
            return bMoved - aMoved;
        });

        const rankLabels = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH"];
        
        scoreboardDiv.innerHTML = "";
        
        sortedPlayers.forEach((player) => {
            let colorHex = this.formatHex(this.colors[player.id].value);
            let rankIndex = this.finishedRanks.indexOf(player.id);
            let displayRank = (rankIndex !== -1) ? rankLabels[rankIndex] : "-";

            scoreboardDiv.innerHTML += `
                <div class="score-row">
                    <div class="score-name">
                        <span style="color:${colorHex}">●</span> ${player.name}
                    </div>
                    <div style="font-weight: bold;">${displayRank}</div>
                </div>
            `;
        });
    }

    // Helper to convert Phaser color to CSS hex
    formatHex(num) {
        return '#' + num.toString(16).padStart(6, '0');
    }

    rotate(x, y, a) {
        return {
            x: x * Math.cos(a) - y * Math.sin(a),
            y: x * Math.sin(a) + y * Math.cos(a)
        };
    }

    drawStar(x, y, angle, colr, colrq) {
        let g = this.add.graphics();
        
        // Fluent Style: Semi-transparent gold fill (0.3 alpha)
        // This allows the tile color or Mica background to bleed through
        g.fillStyle(colr, colrq); 
        
        // Keep the 1px black border at high opacity for visibility
        g.lineStyle(1, 0x000000, 1);

        const points = 5;
        const outerRadius = this.tileSize / 3;
        const innerRadius = this.tileSize / 6;
        const step = Math.PI / points;
        
        g.beginPath();
        
        // Start at the top point
        for (let i = 0; i < 2 * points; i++) {
            let r = (i % 2 === 0) ? outerRadius : innerRadius;
            let currX = Math.cos(i * step - Math.PI / 2) * r;
            let currY = Math.sin(i * step - Math.PI / 2) * r;
            
            if (i === 0) g.moveTo(currX, currY);
            else g.lineTo(currX, currY);
        }

        g.closePath();
        g.fillPath();
        g.strokePath();

        // Position and match tile rotation
        g.setPosition(x, y);
        g.setAngle(Phaser.Math.RadToDeg(angle));
    }

    // --- HELPER TO DRAW DIRECTIONAL ARROWS ---
    // --- HELPER TO DRAW DIRECTIONAL ARROWS ---
    // --- HELPER TO DRAW DIRECTIONAL ARROWS ---
    drawArrow(x, y, angle, color) {
        let g = this.add.graphics();
        
        // Fluent Style: High saturation and thin black border
        g.fillStyle(color, 1);
        g.lineStyle(1, 0x000000, 0.8);
        
        // Dimensions relative to tile size
        const w = this.tileSize * 0.6; // Total width of head
        const h = this.tileSize * 0.7; // Total height
        const shaftW = w * 0.4;        // Width of the arrow tail
        const headH = h * 0.5;         // Height of the triangle tip
        
        // Define the 7 points of a classic arrow pointing "UP" (towards center)
        // Tip is at (0, -h/2)
        const points = [
            { x: 0, y: -h/2 },              // 1. Tip
            { x: w/2, y: -h/2 + headH },    // 2. Right head corner
            { x: shaftW/2, y: -h/2 + headH },// 3. Right shoulder
            { x: shaftW/2, y: h/2 },        // 4. Bottom right
            { x: -shaftW/2, y: h/2 },       // 5. Bottom left
            { x: -shaftW/2, y: -h/2 + headH },// 6. Left shoulder
            { x: -w/2, y: -h/2 + headH }    // 7. Left head corner
        ];
        
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            g.lineTo(points[i].x, points[i].y);
        }
        g.closePath();
        
        g.fillPath();
        g.strokePath();
        
        // Rotate to point toward the center (angle + 90deg)
        g.setAngle(Phaser.Math.RadToDeg(angle) + 180);
        g.setPosition(x, y);
    }
    // ADD THIS TO YOUR CLASS (e.g., after drawArrow or drawStar)
    drawCrown(x, y, angle) {
        let g = this.add.graphics().setDepth(10000); // Ensure it is behind gutis
        
        g.fillStyle(0xFFD700, 0.5); // Gold color
        g.lineStyle(2, 0x000000, 0.6); 

        const w = 36; 
        const h = 24; 

        // Simplified Crown Path
        g.beginPath();
        g.moveTo(-w/2, h/2);   // Bottom Left
        g.lineTo(w/2, h/2);    // Bottom Right
        g.lineTo(w/2, -h/4);   // Right side wall
        g.lineTo(w/3, 0);      // Valley 1
        g.lineTo(0, -h/2);     // Center Peak
        g.lineTo(-w/3, 0);     // Valley 2
        g.lineTo(-w/2, -h/4);  // Left side wall
        g.closePath();

        g.fillPath();
        g.strokePath();

        g.setPosition(x, y);
        g.setAngle(Phaser.Math.RadToDeg(angle));

        return g; // Important: return the object
    }

    setCheatDice(value) {
        if (this.isMoving) return;
        this.diceValue = value;
        const diceDisplay = document.getElementById("diceDisplay");
        if (diceDisplay) {
            diceDisplay.innerText = "🎲 " + this.diceValue + " (SET)";
            diceDisplay.style.color = "#FFD700"; // Golden feedback for admin
            setTimeout(() => diceDisplay.style.color = "white", 1000);
        }
        console.log("Dice Override: " + value);
    }

    setTP(type) {
        this.cheatTPActive = true;
        this.cheatTPType = type;
        document.getElementById("diceDisplay").innerText = "TP: READY";
        console.log("Teleport Primed for: " + type);
    }
}
// Replace your new Phaser.Game config at the bottom with this:
function startPhaserGame() {
    new Phaser.Game({
        type: Phaser.AUTO,
        width: 1200,
        height: 1200,
        transparent: true,
        parent: "game-container",
        scene: LudoGame
    });
}