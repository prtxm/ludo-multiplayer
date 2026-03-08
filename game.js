class  LudoGame extends Phaser.Scene {

    constructor() {
        super("LudoGame");
        
    }
    
    preload() {
        this.load.audio('snd_move', 'assets/move.mp3');
        this.load.audio('snd_kill', 'assets/kill.mp3');
        this.load.audio('snd_star', 'assets/star.mp3');
        this.load.audio('snd_win', 'assets/win.mp3');
        this.load.audio('snd_dice', 'assets/dice-roll.mp3');
    }

    create() {
        // PREVENT PHASER FROM PAUSING WHEN TAB IS HIDDEN
        this.game.events.off('hidden', this.game.onHidden, this.game);
        this.game.events.off('visible', this.game.onVisible, this.game);
        
        // Disable automatic pausing of audio on blur
        this.sound.pauseOnBlur = false;

        window.gameScene = this;

        // 👇 --- DECLARE YOUR SOUND VARIABLES HERE --- 👇
        this.moveSound = this.sound.add('snd_move');
        this.killSound = this.sound.add('snd_kill');
        this.starSound = this.sound.add('snd_star');
        this.winSound = this.sound.add('snd_win');
        this.diceSound = this.sound.add('snd_dice');
        // 👆 ------------------------------------------- 👆

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
        let activeIds = window.activePlayers ? window.activePlayers.map(p => p.id) : [0];

        for (let i = 0; i < 6; i++) {
            let isHuman = activeIds.includes(i);
            let playerName = isHuman ? 
                (window.activePlayers ? window.activePlayers.find(p => p.id === i).name : window.playerNames[i]) 
                : "BOT " + this.colors[i].name;

            let player = { 
                id: i, 
                name: playerName,
                pieces: [],
                isActive: true, // Everyone plays now!
                isBot: !isHuman
            };
            
            let home = this.homeCircles[i];
            const spread = home.radius * 0.45;
            const radius = 11; 

            [45, 135, 225, 315].forEach(deg => {
                let rad = Phaser.Math.DegToRad(deg);
                
                let piece = this.add.circle(
                    home.x + Math.cos(rad) * spread,
                    home.y + Math.sin(rad) * spread,
                    radius, 
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

                // 👇 --- MODIFIED CLICKABLE AREA --- 👇
                // Determine if this piece belongs to the local screen's player
                let isMyPiece = window.activePlayers ? (i === window.myPlayerId) : !player.isBot;

                // Only apply the clickable area & hand cursor to YOUR pieces
                if (isMyPiece) {
                    const hitAreaPadding = 30; // Keeps your pieces easy to tap on mobile
                    
                    piece.setInteractive({
                        hitArea: new Phaser.Geom.Circle(radius, radius, radius + hitAreaPadding),
                        hitAreaCallback: Phaser.Geom.Circle.Contains,
                        useHandCursor: true
                    });
                    
                    piece.on("pointerdown", () => {
                        this.tryMove(piece);
                    });
                }
                // 👆 ------------------------------- 👆

                player.pieces.push(piece);
            });
            
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
    // Handles the actual dice logic with a rolling animation
    async processDiceRoll(val) {
        this.diceValue = val;
        const diceNumber = document.getElementById("diceNumber");
        const diceIcon = document.getElementById("diceIcon");
        const rollBtn = document.getElementById("rollBtn");

        if (!diceNumber || !diceIcon) return;

        if (rollBtn) rollBtn.disabled = true;
        this.isMoving = true;

        if (this.diceSound) {
            this.diceSound.stop();
            this.diceSound.play();
        }

        diceIcon.classList.add("diceRolling");
        for (let i = 0; i < 10; i++) {
            let randomValue = Phaser.Math.Between(1, 6);
            diceNumber.textContent = randomValue;
            await new Promise(resolve => this.time.delayedCall(70, resolve));
        }

        diceNumber.textContent = val;
        await new Promise(resolve => setTimeout(resolve, 600));
        diceIcon.classList.remove("diceRolling");

        this.isMoving = false;
        let player = this.players[this.currentPlayerIndex];

        // FIXED: Corrected path checking logic to prevent JS crashing
        let canMove = player.pieces.some(piece => {
            if (piece.isFinished) return false;
            if (piece.pathIndex === -1) return this.diceValue === 6;
            if (piece.inMiddle) return this.diceValue <= (6 - piece.middleIndex);
            
            let projectedTilesMoved = piece.tilesMoved + this.diceValue;
            if (projectedTilesMoved > 56) return false;
            return true;
        });

        if (!canMove) {
            this.time.delayedCall(1000, () => {
                this.diceValue = 0;
                diceNumber.textContent = "-";
                this.nextTurn();
            });
        } else {
            if (rollBtn && window.myPlayerId === this.currentPlayerIndex && !player.isBot) {
                rollBtn.disabled = false;
            }
            
            // Trigger Bot piece selection (Host manages bots)
            let hostId = window.activePlayers ? window.activePlayers[0].id : 0;
            if (player.isBot && window.myPlayerId === hostId) {
                this.time.delayedCall(600, () => {
                    this.makeBotMove(player);
                });
            }
        }
    } 
    
    resetForNextRoll() {
        this.diceValue = 0;
        this.isMoving = false;

        const rollBtn = document.getElementById("rollBtn");
        const diceNumber = document.getElementById("diceNumber");

        if (diceNumber) diceNumber.textContent = "-";

        if (rollBtn && window.myPlayerId === this.currentPlayerIndex) {
            rollBtn.disabled = false;
        }
    }

    // Called when the server tells us another player rolled
    receiveDiceRoll(val) {
        this.processDiceRoll(val);
    }

    // Called when the server tells us another player rolled
    receiveDiceRoll(val) {
        this.processDiceRoll(val);
    }

    playSoundSafe(audioKey) {
        try {
            // Only play if the browser loaded it successfully and audio is unlocked
            if (this.sound.get(audioKey)) {
                this.sound.play(audioKey);
            } else {
                console.warn("Could not find sound: " + audioKey);
            }
        } catch (error) {
            console.error("Audio playback error:", error);
        }
    }

    // -------------------- MOVEMENT --------------------

    // --- UPDATED MOVEMENT LOGIC ---
    // --- UPDATED TRYMOVE (Ensures it sits in winzone) ---
    // --- UPDATED TRYMOVE (Cheating Prevention) ---
    // --- UPDATED TRYMOVE (Fix Lane Entry) ---
    async tryMove(piece, isRemote = false) {
        let player = this.players[piece.playerId];

        // --- 🔒 CLICK RESTRICTION LOGIC ---
        // Only restrict if online, it's a human, AND it is a local mouse click (not a remote server signal)
        if (window.activePlayers && !player.isBot && !isRemote) {
            // Cannot touch other human players' pieces
            if (piece.playerId !== window.myPlayerId) {
                console.log("You can only move your own pieces!");
                return;
            }
            // Cannot touch pieces if it's not your turn
            if (this.currentPlayerIndex !== window.myPlayerId) {
                console.log("It's not your turn!");
                return;
            }
        }
        // ----------------------------------

        if (this.isMoving) return;
        if (this.currentPlayerIndex !== piece.playerId) return; 
        if (this.diceValue === 0) return;
        
        // --- 1. BASIC CHECKS (Applies to both local and remote) ---
        if (this.diceValue === 0 || this.isMoving || piece.isFinished) return;
        if (piece.playerId !== player.id) return;

        // --- 2. IS THE MOVE PHYSICALLY POSSIBLE? ---
        let rolledSix = (this.diceValue === 6);
        if (piece.pathIndex === -1 && !rolledSix) return; // Can't leave base without a 6
        // ✅ THIS IS THE FIXED LINE ✅
        if (piece.inMiddle) {
            const WIN_INDEX = 6;
            let required = WIN_INDEX - piece.middleIndex;

            if (this.diceValue > required) return;  // block overshoot
        }

        // --- 3. MULTIPLAYER BROADCAST (Only send if the move is actually valid!) ---
        if (!isRemote) {
            let hostId = window.activePlayers ? window.activePlayers[0].id : 0;
            
            if (player.isBot) {
                if (window.myPlayerId !== hostId) return; // Only host emits bot moves
            } else {
                if (window.myPlayerId !== this.currentPlayerIndex) return; 
                if (piece.playerId !== window.myPlayerId) return; 
            }

            let pieceIndex = player.pieces.indexOf(piece);
            window.socket.emit("movePiece", {
                roomCode: window.myRoomCode,
                playerId: player.id,
                pieceIndex: pieceIndex
            });
        }

        // --- REGULAR MOVE LOGIC STARTS HERE ---
        if (this.diceValue === 0 || this.isMoving || piece.isFinished) return;
        if (piece.playerId !== player.id) return;

        let steps = this.diceValue;
        let reachedWinZone = false; // Track if this guti finishes

        if (piece.pathIndex === -1) {
            if (steps !== 6) return; 
            this.diceValue = 0;
            document.getElementById("diceNumber").textContent = "-";
            piece.pathIndex = this.startIndices[player.id];
            piece.tilesMoved = 0; 
            this.starSound.play();
            
            await this.animateTo(piece, this.globalOuterPath[piece.pathIndex]);
            this.arrangePieces(); 

            // 🔥 FIX: Ensure the bot is told to roll again after bringing a piece out
            if (!rolledSix) {
                this.nextTurn();
            } else {
                console.log("Extra Turn Granted (Base Exit)!");
                this.resetForNextRoll();
                
                if (player.isBot) {
                    this.triggerBotTurn();
                }
            }
            return; // Function exits here after spawning
        }

        if (piece.inMiddle) {
            const WIN_INDEX = 6;
            let required = WIN_INDEX - piece.middleIndex;

            if (this.diceValue > required) return;  // block overshoot
        }
        this.diceValue = 0;
        document.getElementById("diceNumber").textContent = "-";

        while (steps > 0) {
            if (!piece.inMiddle) {
                let currentTile = this.globalOuterPath[piece.pathIndex];

                if (piece.tilesMoved >= 70 && currentTile.row === 0 && currentTile.col === 0 && currentTile.player === player.id) {
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
                    this.winSound.play();
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
        if (!wasCapture && !reachedWinZone && !piece.inMiddle && piece.pathIndex !== -1) {
            let finalTile = this.globalOuterPath[piece.pathIndex];
            if (finalTile && finalTile.isStar) {
                this.starSound.play();
            }
        }
        this.arrangePieces();

        // 🔥 Updated Turn Logic
        if (!rolledSix && !wasCapture && !reachedWinZone) {
            this.nextTurn();
        } else {
            console.log("Extra Turn Granted!");

            // IMPORTANT: properly reset dice state
            this.resetForNextRoll();

            // 🔥 NEW: If the current player is a bot, trigger their extra roll automatically
            if (player.isBot) {
                this.triggerBotTurn();
            }
        }

        this.updateScoreboard();
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
                if (!capturedAny) {
                    this.killSound.play();
                }
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
        this.moveSound.play();

        // Calculate exact target coordinates
        let targetX = tile.x || (this.centerX + tile.x);
        let targetY = tile.y || (this.centerY + tile.y);

        // 🔥 DOTTED TRAIL EFFECT 🔥
        // Drop a single small dot at the tile the piece is currently LEAVING
        let dot = this.add.circle(piece.x, piece.y, 4.5, piece.fillColor)
            .setDepth(1999) // Just below the piece
            .setAlpha(0.9); // Start highly visible
        
        // Make the dot linger and slowly shrink/fade away so you can see the path
        this.tweens.add({
            targets: dot,
            alpha: 0,
            scale: 0,
            duration: 900, 
            ease: 'Sine.easeOut',
            onComplete: () => dot.destroy()
        });

        return new Promise(resolve => {
            this.tweens.add({
                targets: piece,
                x: targetX,
                y: targetY,
                duration: 250,
                ease: 'Sine.easeInOut',
                onComplete: resolve
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
        // 🔥 FIX: Always reset dice value and moving state when a turn ends
        this.diceValue = 0;
        this.isMoving = false;
        
        const diceNumber = document.getElementById("diceNumber");
        if (diceNumber) {
            diceNumber.textContent = "-";
        }

        if (this.finishedRanks.length >= 5) {
            // Stop when 5 players finish
            document.getElementById("turnDisplay").innerText = "GAME OVER";
            return;
        }

        let loopSafeguard = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 6;
            loopSafeguard++;
        } while (
            loopSafeguard < 10 && this.finishedRanks.includes(this.currentPlayerIndex)
        );

        this.updateTurnUI();
        this.triggerBotTurn();
    }

    updateTurnUI() {
        const playerColor = this.colors[this.currentPlayerIndex];
        const playerObj = this.players[this.currentPlayerIndex];
        const turnText = document.getElementById("turnDisplay");
        const rollBtn = document.getElementById("rollBtn") || document.getElementById("rollButton");

        if (!turnText || !rollBtn) return;

        turnText.innerText = playerObj.name + "'S TURN";

        if (window.myPlayerId === this.currentPlayerIndex && !playerObj.isBot) {
            rollBtn.style.display = "block";
            turnText.innerText += " (YOU)";
            if (!this.isMoving) rollBtn.disabled = false; 
        } else {
            rollBtn.style.display = "none";
        }
        
        const hexColor = this.formatHex(playerColor.value);
        rollBtn.style.background = `linear-gradient(135deg, ${hexColor} 0%, #222 150%)`;
        rollBtn.style.boxShadow = `0 10px 20px ${hexColor}44`;
        turnText.style.color = hexColor;
        turnText.style.textShadow = `0 0 10px ${hexColor}66`;
    }

    triggerBotTurn() {
        let playerObj = this.players[this.currentPlayerIndex];
        let hostId = window.activePlayers && window.activePlayers.length > 0 ? window.activePlayers[0].id : 0;
        
        if (playerObj.isBot && window.myPlayerId === hostId) {
            this.time.delayedCall(1000, () => {
                if (this.isMoving || this.diceValue > 0) return;
                let val = Phaser.Math.Between(1, 6);
                window.socket.emit("rollDice", {
                    roomCode: window.myRoomCode,
                    diceValue: val,
                    playerId: this.currentPlayerIndex
                });
                this.processDiceRoll(val);
            });
        }
    }

    makeBotMove(player) {
        let movablePieces = player.pieces.filter(piece => {
            if (piece.isFinished) return false;
            if (piece.pathIndex === -1) return this.diceValue === 6;
            if (piece.inMiddle) return this.diceValue <= (6 - piece.middleIndex);
            
            let projectedTilesMoved = piece.tilesMoved + this.diceValue;
            if (projectedTilesMoved > 56) return false;
            return true;
        });

        if (movablePieces.length === 0) return;

        let bestPiece = null;
        let bestScore = -Infinity;

        movablePieces.forEach(piece => {
            let score = 0;

            // 1. SPAWNING A NEW PIECE
            if (piece.pathIndex === -1) {
                score += 400; 
            } 
            
            // 2. PIECE IS ALREADY IN THE MIDDLE LANE
            else if (piece.inMiddle) {
                let targetMiddleIndex = piece.middleIndex + this.diceValue;
                if (targetMiddleIndex === 6) {
                    score += 1000; // 🏆 WINNING MOVE
                } else {
                    score += 50;   // Safely advancing inside middle lane
                }
            } 
            
            // 3. MOVING ON THE MAIN BOARD (OUTER PATH)
            else {
                let projectedTilesMoved = piece.tilesMoved + this.diceValue;
                
                // --- A. Entering the middle lane ---
                if (projectedTilesMoved >= 50) {
                    let targetMiddleIndex = projectedTilesMoved - 50;
                    if (targetMiddleIndex === 6) {
                        score += 1000; // 🏆 WINNING MOVE exactly from outer track
                    } else {
                        score += 300;  // 🛡️ Safe! Getting into middle lane
                    }
                } 
                
                // --- B. Staying on the outer path ---
                else {
                    let targetPathIndex = (piece.pathIndex + this.diceValue) % this.globalOuterPath.length;
                    let targetTile = this.globalOuterPath[targetPathIndex];
                    
                    // ⚔️ CHECK FOR KILLS
                    let canKill = false;
                    if (!targetTile.isStar) { // Can't kill on a star
                        for (let otherPlayer of this.players) {
                            if (otherPlayer.id === player.id) continue;
                            for (let oppPiece of otherPlayer.pieces) {
                                if (!oppPiece.inMiddle && oppPiece.pathIndex === targetPathIndex && !oppPiece.isFinished) {
                                    canKill = true;
                                    break;
                                }
                            }
                            if (canKill) break;
                        }
                    }
                    if (canKill) score += 500; // Huge priority to kill

                    // ⭐ LANDING ON A SAFE STAR
                    if (targetTile.isStar) {
                        score += 150;
                    }

                    // 🏃 ESCAPING DANGER
                    let currentlyInDanger = false;
                    let currentTile = this.globalOuterPath[piece.pathIndex];
                    if (!currentTile.isStar) { // If we aren't already safe
                        for (let otherPlayer of this.players) {
                            if (otherPlayer.id === player.id) continue;
                            for (let oppPiece of otherPlayer.pieces) {
                                if (!oppPiece.inMiddle && oppPiece.pathIndex !== -1 && !oppPiece.isFinished) {
                                    // Distance from opponent to us
                                    let dist = (piece.pathIndex - oppPiece.pathIndex + this.globalOuterPath.length) % this.globalOuterPath.length;
                                    if (dist > 0 && dist <= 5) {
                                        currentlyInDanger = true;
                                        break;
                                    }
                                }
                            }
                            if (currentlyInDanger) break;
                        }
                    }
                    if (currentlyInDanger) {
                        score += 200; // Run away!
                    }

                    // 📏 TIE-BREAKER: Favor moving pieces that are further ahead
                    score += piece.tilesMoved;
                }
            }

            // 🎲 Add a tiny random factor (0 to 9) so the bot breaks ties naturally
            score += Phaser.Math.Between(0, 9);

            // Keep track of the piece with the highest score
            if (score > bestScore) {
                bestScore = score;
                bestPiece = piece;
            }
        });

        // Execute the best calculated move
        if (bestPiece) {
            this.tryMove(bestPiece);
        }
    }

    // Helper function to convert Phaser hex to CSS hex
    formatHex(val) {
        return "#" + val.toString(16).padStart(6, '0');
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

}
/* =========================================================
   📱 ISOLATED MOBILE CANVAS SCALING CONFIG
   ========================================================= */
const config = {
    // ... [KEEP YOUR EXISTING CONFIG HERE: type, parent, scene, physics, etc.] ...

    // 👇 DROP THIS IN AS A SEPARATE SECTION 👇
    scale: {
        // FIT automatically shrinks the game to fit the screen without stretching
        mode: Phaser.Scale.FIT, 
        
        // Centers the board horizontally and vertically within its new mobile container
        autoCenter: Phaser.Scale.CENTER_BOTH, 
        
        // KEEP your original desktop dimensions here (e.g., 800x800 or whatever you used). 
        // Phaser will use this as the baseline and scale down automatically for mobile.
        width: 800,  
        height: 800,
    },
    // 👆 END OF SCALING SECTION 👆
};
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