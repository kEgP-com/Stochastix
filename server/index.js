const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Room = require('./game/Room');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = {};

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const History = require('./models/History');

let globalUsers = {};
let globalHistory = [];

const usersPath = path.join(__dirname, 'users.json');
const historyPath = path.join(__dirname, 'history.json');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.log('No MONGO_URI found. Falling back to JSON files.');
      if (fs.existsSync(usersPath)) {
        globalUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      }
      if (fs.existsSync(historyPath)) {
        globalHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
    
    // Load into memory for synchronous gameplay
    const users = await User.find();
    users.forEach(u => {
      globalUsers[u.username] = { points: u.points, password: u.password, email: u.email };
    });
    
    globalHistory = await History.find().lean();
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};
connectDB();

const saveUsers = async () => {
  if (!process.env.MONGO_URI) {
    fs.writeFileSync(usersPath, JSON.stringify(globalUsers, null, 2));
    return;
  }
  for (const [username, data] of Object.entries(globalUsers)) {
    await User.findOneAndUpdate(
      { username },
      { points: data.points, password: data.password || null, email: data.email || null },
      { upsert: true }
    ).catch(console.error);
  }
};

const saveHistory = async (newEntry) => {
  if (!process.env.MONGO_URI) {
    fs.writeFileSync(historyPath, JSON.stringify(globalHistory, null, 2));
    return;
  }
  try {
    const entry = new History(newEntry);
    await entry.save();
  } catch (err) {
    console.error('Failed to save history entry', err);
  }
};

const handleAuth = async (username, socket, password, email) => {
  if (!globalUsers[username]) {
    globalUsers[username] = { points: 1000, password: password || null, email: email || null };
    await saveUsers();
  } else {
    let changed = false;
    if (!globalUsers[username].password && password) {
      globalUsers[username].password = password;
      changed = true;
    }
    if (!globalUsers[username].email && email) {
      globalUsers[username].email = email;
      changed = true;
    }
    if (changed) await saveUsers();
  }
  socket.emit('authSuccess', { username, points: globalUsers[username].points });
};

const processGameOverPoints = (room) => {
  const pList = Object.entries(room.players).map(([id, p]) => ({ id, ...p }));
  const n = pList.length;
  // Sort by pieces remaining ascending (fewer pieces = better rank)
  pList.sort((a, b) => {
    if (a.id === room.finalWinner) return -1;
    if (b.id === room.finalWinner) return 1;
    return a.totalPieces - b.totalPieces;
  });

  const avgRank = (n + 1) / 2;
  pList.forEach((p, index) => {
    const rank = index + 1;
    const diff = avgRank - rank;
    const pointChange = Math.round(diff * 50);

    // Apply the calculated pointChange to the actual room.players object so clients receive it
    room.players[p.id].pointChange = pointChange;

    if (!p.isAI) {
      if (globalUsers[p.name]) {
        globalUsers[p.name].points = (globalUsers[p.name].points || 1000) + pointChange;
        saveUsers();
        io.emit('pointsUpdated', { username: p.name, points: globalUsers[p.name].points });
      }
    }
  });
};

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', async ({ email, username, password }) => {
    console.log('Register attempt:', username);
    // Ensure email is unique across all users
    const emailExists = Object.values(globalUsers).some(u => u.email === email);
    if (emailExists) {
      return socket.emit('error', 'Email already in use');
    }

    if (globalUsers[username]) {
      return socket.emit('error', 'Username already exists');
    }

    globalUsers[username] = { points: 1000, password: password, email: email };
    await saveUsers();
    
    socket.emit('registerSuccess');
  });

  socket.on('login', async ({ username, password }) => {
    console.log('Login attempt:', username);
    if (globalUsers[username] && globalUsers[username].password && globalUsers[username].password !== password) {
      return socket.emit('error', 'Incorrect password');
    }
    handleAuth(username, socket, password);
  });

let passwordResetCodes = {};

  socket.on('requestPasswordReset', ({ email }) => {
    // Find user by email
    const userEntry = Object.entries(globalUsers).find(([u, data]) => data.email === email);
    if (!userEntry) {
      return socket.emit('error', 'No account found with that email address');
    }
    const username = userEntry[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    passwordResetCodes[email] = { code, username, expires: Date.now() + 15 * 60 * 1000 };
    
    // Simulate sending email
    console.log(`\n=== PASSWORD RESET ===\nEmail: ${email}\nCode: ${code}\n======================\n`);
    socket.emit('passwordResetRequested', { email });
  });

  socket.on('resetPassword', async ({ email, code, newPassword }) => {
    const resetData = passwordResetCodes[email];
    if (!resetData) return socket.emit('error', 'No password reset requested for this email');
    if (Date.now() > resetData.expires) return socket.emit('error', 'Reset code has expired');
    if (resetData.code !== code) return socket.emit('error', 'Invalid reset code');
    
    const username = resetData.username;
    if (globalUsers[username]) {
      globalUsers[username].password = newPassword;
      await saveUsers();
      delete passwordResetCodes[email];
      socket.emit('passwordResetSuccess');
    }
  });

  socket.on('updateProfile', async ({ oldUsername, newUsername }) => {
    if (!globalUsers[oldUsername]) return socket.emit('error', 'User not found');
    if (oldUsername === newUsername) return;
    if (globalUsers[newUsername]) return socket.emit('error', 'Username already taken');

    // Move user in memory
    globalUsers[newUsername] = globalUsers[oldUsername];
    delete globalUsers[oldUsername];
    
    if (process.env.MONGO_URI) {
      // Create new user, delete old user
      try {
        const newUser = new User({ username: newUsername, points: globalUsers[newUsername].points, password: globalUsers[newUsername].password, email: globalUsers[newUsername].email });
        await newUser.save();
        await User.deleteOne({ username: oldUsername });
        
        // Update history
        await History.updateMany(
          { winner: oldUsername },
          { $set: { winner: newUsername } }
        );
        await History.updateMany(
          { "players.name": oldUsername },
          { $set: { "players.$.name": newUsername } }
        );
      } catch(err) { console.error(err); }
    }
    await saveUsers(); // JSON or Mongo fallback update
    
    // Update memory history
    globalHistory.forEach(h => {
      if (h.winner === oldUsername) h.winner = newUsername;
      h.players.forEach(p => {
        if (p.name === oldUsername) p.name = newUsername;
      });
    });
    if (!process.env.MONGO_URI) fs.writeFileSync(historyPath, JSON.stringify(globalHistory, null, 2));

    socket.emit('profileUpdated', { username: newUsername, points: globalUsers[newUsername].points });
    io.emit('historyData', globalHistory);
  });

  socket.on('getHistory', () => {
    socket.emit('historyData', globalHistory);
  });

  socket.on('createRoom', ({ name, isSinglePlayer }) => {
    const roomId = generateRoomId();
    const room = new Room(roomId);
    room.isSinglePlayer = !!isSinglePlayer;
    room.addPlayer(socket.id, name);
    
    if (isSinglePlayer) {
      room.addPlayer('ai-' + Math.random().toString(36).substr(2, 5), 'Computer Player', true);
    }
    
    rooms[roomId] = room;
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    io.to(roomId).emit('roomState', room.getState());
  });

  socket.on('updatePassword', ({ username, oldPassword, newPassword }) => {
    // In a real app we'd check oldPassword, but we have no auth token right now
    if (globalUsers[username]) {
      // Just update it
      globalUsers[username].password = newPassword;
      saveUsers();
      socket.emit('passwordUpdated');
    }
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('error', 'Room not found');
    }
    if (Object.keys(room.players).length >= room.settings.maxPlayers) {
      return socket.emit('error', `Room is full (Maximum ${room.settings.maxPlayers} players)`);
    }
    if (room.addPlayer(socket.id, name)) {
      socket.join(roomId);
      io.to(roomId).emit('roomState', room.getState());
    } else {
      socket.emit('error', 'Cannot join right now (Game already started?)');
    }
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      const allHumansReady = Object.values(room.players).filter(p => !p.isAI).every(p => p.lobbyReady);
      if (allHumansReady) {
        room.state = 'SETUP';
        room.startSetupPhase();
        io.to(roomId).emit('roomState', room.getState());
      }
    }
  });

  socket.on('forceTiebreakerDebug', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      if (Object.keys(room.players).length === 1) {
        room.addPlayer('ai-' + Math.random().toString(36).substr(2, 5), 'AI Opponent', true);
      }
      room.isDebugMatch = true;
      room.state = 'TIEBREAKER';
      room.tiebreaker = {
        tiedPlayers: Object.keys(room.players),
        scores: Object.keys(room.players).reduce((acc, p) => ({...acc, [p]: 0}), {}),
        flips: [],
        currentFlips: {},
        round: 1
      };
      io.to(roomId).emit('roomState', room.getState());
    }
  });

  socket.on('resetToLobby', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      room.state = 'LOBBY';
      // Unready everyone
      for (const p of Object.values(room.players)) {
        p.lobbyReady = false;
      }
      io.to(roomId).emit('roomState', room.getState());
    }
  });

  socket.on('leaveRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(roomId);
      if (Object.keys(room.players).length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('roomState', room.getState());
      }
    }
  });

  socket.on('addAI', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.state === 'LOBBY') {
      const aiId = 'AI_' + Math.random().toString(36).substring(2, 8);
      room.addPlayer(aiId, 'Computer Player', true);
      io.to(roomId).emit('roomState', room.getState());
    }
  });

  socket.on('updateSettings', ({ roomId, settings }) => {
    const room = rooms[roomId];
    if (room && room.updateSettings(socket.id, settings)) {
      io.to(roomId).emit('roomState', room.getState());
    }
  });

  socket.on('toggleLobbyReady', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.toggleLobbyReady(socket.id)) {
      io.to(roomId).emit('roomState', room.getState());
    }
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.startGame(socket.id)) {
      io.to(roomId).emit('roomState', room);
    }
  });

  socket.on('setPlacement', ({ roomId, placement }) => {
    const room = rooms[roomId];
    if (room && room.setPlacement(socket.id, placement)) {
      io.to(roomId).emit('roomState', room);
    }
  });

  socket.on('unreadyPlacement', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.unreadyPlacement(socket.id)) {
      io.to(roomId).emit('roomState', room);
    }
  });

  socket.on('hostForceRoll', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id && room.state === 'PLAYING') {
      // Force all human players to be ready
      for (const p in room.players) {
        if (!room.players[p].isAI) {
          room.players[p].readyToRoll = true;
        }
      }
      const result = room.setReadyToRoll(socket.id); // This will trigger the roll
      if (result && result.rolled) {
        io.to(roomId).emit('diceRolled', result);
        io.to(roomId).emit('roomState', room);

        if (room.state === 'GAMEOVER') {
          if (!room.isDebugMatch) {
            processGameOverPoints(room);
            const newEntry = {
              id: room.id,
              timestamp: Date.now(),
              settings: room.settings,
              players: Object.values(room.players).map(p => ({ name: p.name, isAI: p.isAI, pointChange: p.pointChange })),
              winner: room.players[room.finalWinner]?.name || 'Unknown',
              totalRolls: room.history.length,
              rolls: [...room.history],
              tiebreaker: room.tiebreaker ? { ...room.tiebreaker } : null
            };
            globalHistory.push(newEntry);
            saveHistory(newEntry);
            io.emit('historyData', globalHistory);
          }
        }
      }
    }
  });

  socket.on('toggleReadyToRoll', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.state === 'PLAYING' && room.players[socket.id]) {
      room.players[socket.id].readyToRoll = !room.players[socket.id].readyToRoll;
      io.to(roomId).emit('roomState', room);
    }
  });

  socket.on('playTiebreaker', ({ roomId, choice }) => {
    const room = rooms[roomId];
    if (room && room.state === 'TIEBREAKER') {
      const res = room.playTiebreaker(socket.id, choice);
      if (res) {
        if (res.roundComplete) {
          io.to(roomId).emit('tiebreakerResolved', res.lastRoundData);
          setTimeout(() => {
            if (room.state === 'GAMEOVER') {
              if (!room.isDebugMatch) {
                processGameOverPoints(room);
                const newEntry = {
                  id: room.id,
                  timestamp: Date.now(),
                  settings: room.settings,
                  players: Object.values(room.players).map(p => ({ name: p.name, isAI: p.isAI, pointChange: p.pointChange })),
                  winner: room.players[room.finalWinner]?.name || 'Unknown',
                  totalRolls: room.history.length,
                  rolls: [...room.history],
                  tiebreaker: room.tiebreaker ? { ...room.tiebreaker } : null
                };
                globalHistory.push(newEntry);
                saveHistory(newEntry);
                io.emit('historyData', globalHistory);
              }
            }
            io.to(roomId).emit('roomState', room.getState());
          }, 2500);
        } else {
          io.to(roomId).emit('roomState', room.getState());
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        room.removePlayer(socket.id);
        const hasActivePlayers = Object.values(room.players).some(p => !p.disconnected && !p.isAI);
        if (!hasActivePlayers) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomState', room);
        }
      }
    }
  });
});

// Serve static frontend in production
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  
  // Catch-all route to serve the React app (replaces app.get('*') to avoid path-to-regexp errors)
  app.use((req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
