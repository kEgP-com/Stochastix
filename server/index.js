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

const historyPath = path.join(__dirname, 'history.json');
let globalHistory = [];
if (fs.existsSync(historyPath)) {
  globalHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
}
const saveHistory = () => {
  fs.writeFileSync(historyPath, JSON.stringify(globalHistory, null, 2));
};

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', async ({ email, username, password }) => {
    socket.emit('authSuccess', username);
  });

  socket.on('login', async ({ username, password }) => {
    socket.emit('authSuccess', username);
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

  socket.on('joinRoom', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('error', 'Room not found');
    }
    if (Object.keys(room.players).length >= 8) {
      return socket.emit('error', 'Room is full (Maximum 8 players)');
    }
    if (room.addPlayer(socket.id, name)) {
      socket.join(roomId);
      io.to(roomId).emit('roomState', room.getState());
    } else {
      socket.emit('error', 'Cannot join right now (Game already started?)');
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

  socket.on('readyToRoll', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      const result = room.setReadyToRoll(socket.id);
      if (result && result.rolled) {
        io.to(roomId).emit('diceRolled', result);
        io.to(roomId).emit('roomState', room);

        if (room.state === 'GAMEOVER') {
          globalHistory.push({
            id: room.id,
            timestamp: Date.now(),
            settings: room.settings,
            players: Object.values(room.players).map(p => ({ name: p.name, isAI: p.isAI })),
            winner: room.players[room.finalWinner]?.name || 'Unknown',
            totalRolls: room.history.length,
            rolls: [...room.history],
            tiebreaker: room.tiebreaker ? { ...room.tiebreaker } : null
          });
          saveHistory();
          io.emit('historyData', globalHistory);
        }
      } else if (result) {
        // Just broadcast roomState to show who is ready
        io.to(roomId).emit('roomState', room);
      }
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
            io.to(roomId).emit('roomState', room.getState());
            if (room.state === 'GAMEOVER') {
              globalHistory.push({
                id: room.id,
                timestamp: Date.now(),
                settings: room.settings,
                players: Object.values(room.players).map(p => ({ name: p.name, isAI: p.isAI })),
                winner: room.players[room.finalWinner]?.name || 'Unknown',
                totalRolls: room.history.length,
                rolls: [...room.history],
                tiebreaker: room.tiebreaker ? { ...room.tiebreaker } : null
              });
              saveHistory();
              io.emit('historyData', globalHistory);
            }
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
        if (Object.keys(room.players).length === 0) {
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
