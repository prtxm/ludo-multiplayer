# 🎲 6-Player Multiplayer Ludo (Dark Mica Edition)

A real-time, cross-platform, 6-player Ludo game built with Phaser.js and Node.js. Featuring a sleek Windows 11-inspired "Dark Mica" frosted glass UI, fully synchronized multiplayer via Socket.io, and a mobile-first responsive design.

## ✨ Features

* **Real-time Multiplayer:** Create custom rooms with 4-digit codes and play globally with friends.
* **Dynamic Player Scaling:** The game automatically adjusts turns and piece spawning whether 2, 3, 4, 5, or 6 players join.
* **Windows 11 "Mica" UI:** Custom CSS featuring frosted glass backdrops, smooth transitions, and a premium dark mode aesthetic.
* **Mobile-Optimized:** * Strict viewport locking prevents accidental zooming or panning on touch devices.
  * Smart UI repositioning moves controls to the bottom of the screen on mobile for easy thumb access.
* **Custom Event Notifications:** Built-in sliding, auto-fading notification system replaces clunky browser alerts.
* **Robust Disconnect Handling:** If any player abandons the game or loses connection, the room is safely destroyed and remaining players are notified to ensure fair play.
* **100% Fair Play:** Server-enforced turn logic with all developer cheat tools removed for production.

## 🛠️ Tech Stack

* **Frontend Engine:** [Phaser 3](https://phaser.io/) (HTML5 Canvas)
* **Styling:** Custom Vanilla CSS3 (CSS Variables, Flexbox, Grid, Media Queries)
* **Backend Server:** Node.js with [Express](https://expressjs.com/)
* **Real-time Communication:** [Socket.io](https://socket.io/)
* **Hosting:** Ready for deployment on platforms like [Render](https://render.com/) or Heroku.

## 🚀 How to Run Locally

To test or modify the game on your own machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/multiplayer-ludo.git](https://github.com/yourusername/multiplayer-ludo.git)
   cd multiplayer-ludo
2. **Install dependencies:**
Make sure you have Node.js installed, then run:
   ```bash
   npm install
3. **Start the server:**
   ```bash
   npm start
4. **Play:**  Open your browser and navigate to http://localhost:3000. To test multiplayer locally, open multiple incognito tabs

## 📱 How to Play
* **Open the game link on your PC or Mobile device.**
* **Enter your Name and a custom Room Code (e.g., 2008).**
* **Click JOIN / CREATE ROOM.**
* **Share the Room Code with your friends.**
* **Once everyone is in the lobby, the Host (Player 1) clicks Start Game.**
* **Roll the dice, move your pieces, and race to the center!**

## 🤝 Contributing
Pull requests are welcome! If you'd like to add new features (like a chat box, custom avatars, or sound effects), feel free to fork the repository and submit a PR.

*Created using HTML, JS, and Node.*
