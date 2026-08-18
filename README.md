# 🎲 Stochastix

Stochastix is a real-time multiplayer probability and dice game where players race to eliminate all their blocks before their opponents do. The game features live multiplayer sync, strategic block placement, gambling mechanics, and intense Rock-Paper-Scissors tiebreakers!

## 🎮 How to Play

### 1. Getting Started
- **Login:** Simply type in any username and password to log in. (Registration is currently in arcade-mode, so any nickname will instantly let you in!)
- **Create a Game:** Click "Create New Game" to host a room. You can invite friends by giving them the **Room Code**, or you can click **"Add AI Player"** to play against the computer.
- **Join a Game:** Enter a friend's 6-letter Room Code to join their lobby.

### 2. Gameplay Mechanics
- **Setup Phase:** Before the game begins, you must place your blocks onto the board numbers (2 through 12). 
- **Rolling:** During the game, players take turns clicking **Ready to Roll**. Once everyone is ready, the dice are rolled automatically.
- **Elimination:** If the dice sum matches a number where you have a block, one block is eliminated from your board!
- **Winning:** The first player to eliminate all their blocks wins the game.

### 3. Tiebreakers
If two or more players eliminate their final block on the exact same roll, a Sudden Death tiebreaker is triggered! The host can choose the tiebreaker mode in the lobby settings:
- **Rock, Paper, Scissors:** A Best-of-3 match. Choose your move carefully!
- **Coin Flip:** A classic 50/50 flip. Guess Heads or Tails.

### 4. Casino Points (Gambling) 💰
Every player starts with a bankroll of **1,000 points**. 
Stochastix uses a zero-sum placement system:
- When a game ends, the server calculates the "Average Rank" of all players.
- If you place **above average**, you steal points from the losers.
- If you place **below average**, you lose points.
- The higher your placement, the bigger your payout! 

---

## 🚀 Deployment & Tech Stack

Stochastix is built with **React**, **Vite**, **Express**, and **Socket.io**. It is designed to be instantly deployable to Render's free tier.

**To run locally:**
```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Build the frontend
cd ../client && npm run build

# Start the server (serves both API and Frontend)
cd ../server
node index.js
```
The game will be live at `http://localhost:3001`!
