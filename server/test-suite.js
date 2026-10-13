const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('../client/node_modules/socket.io-client');
const Room = require('./game/Room');
const fs = require('fs');
const path = require('path');

// Test runner helper
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== STARTING STOCHASTIX FUNCTIONALITY TEST SUITE ===\n');

  // We will start a test server on port 3099 to avoid conflicting with any running dev server
  const TEST_PORT = 3099;
  
  // We'll require and configure the server app or test against the actual server module
  // Let's spawn or test directly with the Room class and socket events
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  const rooms = {};
  let globalUsers = {};
  let globalHistory = [];
  let passwordResetCodes = {};

  const saveUsers = async () => {};
  const saveHistory = async () => {};
  const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleAuth = async (username, socket, password, email) => {
    if (!globalUsers[username]) {
      globalUsers[username] = { points: 1000, password: password || null, email: email || null };
    }
    socket.emit('authSuccess', { username, points: globalUsers[username].points });
  };

  const processGameOverPoints = (room) => {
    const pList = Object.entries(room.players).map(([id, p]) => ({ id, ...p }));
    const n = pList.length;
    const hasAI = pList.some(p => p.isAI);
    pList.sort((a, b) => {
      if (a.id === room.finalWinner) return -1;
      if (b.id === room.finalWinner) return 1;
      return a.totalPieces - b.totalPieces;
    });
    const avgRank = (n + 1) / 2;
    pList.forEach((p, index) => {
      const rank = index + 1;
      const diff = avgRank - rank;
      const pointChange = hasAI ? 0 : Math.round(diff * 50);
      room.players[p.id].pointChange = pointChange;
      if (!p.isAI && globalUsers[p.name] && !hasAI) {
        globalUsers[p.name].points = (globalUsers[p.name].points || 1000) + pointChange;
      }
    });
  };

  io.on('connection', (socket) => {
    socket.on('register', async ({ email, username, password }) => {
      const emailExists = Object.values(globalUsers).some(u => u.email === email);
      if (emailExists) return socket.emit('error', 'Email already in use');
      if (globalUsers[username]) return socket.emit('error', 'Username already exists');
      globalUsers[username] = { points: 1000, password, email };
      socket.emit('registerSuccess');
    });

    socket.on('login', async ({ username, password }) => {
      if (globalUsers[username] && globalUsers[username].password && globalUsers[username].password !== password) {
        return socket.emit('error', 'Incorrect password');
      }
      handleAuth(username, socket, password);
    });

    socket.on('requestPasswordReset', ({ email }) => {
      const userEntry = Object.entries(globalUsers).find(([u, data]) => data.email === email);
      if (!userEntry) return socket.emit('error', 'No account found with that email address');
      const username = userEntry[0];
      const code = '123456';
      passwordResetCodes[email] = { code, username, expires: Date.now() + 15 * 60 * 1000 };
      socket.emit('passwordResetRequested', { email });
    });

    socket.on('resetPassword', async ({ email, code, newPassword }) => {
      const resetData = passwordResetCodes[email];
      if (!resetData) return socket.emit('error', 'No password reset requested for this email');
      if (resetData.code !== code) return socket.emit('error', 'Invalid reset code');
      globalUsers[resetData.username].password = newPassword;
      delete passwordResetCodes[email];
      socket.emit('passwordResetSuccess');
    });

    socket.on('updateProfile', async ({ oldUsername, newUsername }) => {
      if (!globalUsers[oldUsername]) return socket.emit('error', 'User not found');
      if (oldUsername === newUsername) return;
      if (globalUsers[newUsername]) return socket.emit('error', 'Username already taken');
      globalUsers[newUsername] = globalUsers[oldUsername];
      delete globalUsers[oldUsername];
      socket.emit('profileUpdated', { username: newUsername, points: globalUsers[newUsername].points });
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
      if (!room) return socket.emit('error', 'Room not found');
      if (Object.keys(room.players).length >= room.settings.maxPlayers) {
        return socket.emit('error', `Room is full (Maximum ${room.settings.maxPlayers} players)`);
      }
      if (room.addPlayer(socket.id, name)) {
        socket.join(roomId);
        io.to(roomId).emit('roomState', room.getState());
      } else {
        socket.emit('error', 'Cannot join right now');
      }
    });

    socket.on('kickPlayer', ({ roomId, targetId }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id && (room.state === 'LOBBY' || room.state === 'SETUP')) {
        room.removePlayer(targetId);
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.leave(roomId);
          targetSocket.emit('kicked');
        }
        io.to(roomId).emit('roomState', room.getState());
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
      if (room && room.host === socket.id) {
        if (room.startGame(socket.id)) {
          io.to(roomId).emit('roomState', room.getState());
        }
      }
    });

    socket.on('setPlacement', ({ roomId, placement }) => {
      const room = rooms[roomId];
      if (room && room.setPlacement(socket.id, placement)) {
        io.to(roomId).emit('roomState', room.getState());
      }
    });

    socket.on('unreadyPlacement', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.unreadyPlacement(socket.id)) {
        io.to(roomId).emit('roomState', room.getState());
      }
    });

    socket.on('hostForceRoll', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id && room.state === 'PLAYING') {
        for (const p in room.players) {
          if (!room.players[p].isAI) room.players[p].readyToRoll = true;
        }
        const result = room.setReadyToRoll(socket.id);
        if (result && result.rolled) {
          io.to(roomId).emit('diceRolled', result);
          if (room.state === 'GAMEOVER') {
            processGameOverPoints(room);
          }
          io.to(roomId).emit('roomState', room.getState());
        }
      }
    });

    socket.on('toggleReadyToRoll', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.state === 'PLAYING' && room.players[socket.id]) {
        room.players[socket.id].readyToRoll = !room.players[socket.id].readyToRoll;
        const allHumansReady = Object.values(room.players).filter(p => !p.isAI).every(p => p.readyToRoll);
        if (allHumansReady) {
          const result = room.setReadyToRoll(socket.id);
          if (result && result.rolled) {
            io.to(roomId).emit('diceRolled', result);
            if (room.state === 'GAMEOVER') {
              processGameOverPoints(room);
            }
            io.to(roomId).emit('roomState', room.getState());
          }
        } else {
          io.to(roomId).emit('roomState', room.getState());
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
              if (room.state === 'GAMEOVER') {
                processGameOverPoints(room);
              }
              io.to(roomId).emit('roomState', room.getState());
            }, 100);
          } else {
            io.to(roomId).emit('roomState', room.getState());
          }
        }
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
  });

  await new Promise(r => server.listen(TEST_PORT, r));
  console.log(`Test server running on port ${TEST_PORT}\n`);

  const createClient = () => {
    return ClientIO(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      forceNew: true
    });
  };

  const c1 = createClient();
  const c2 = createClient();
  await new Promise(r => c1.on('connect', r));
  await new Promise(r => c2.on('connect', r));

  console.log('--- TEST GROUP 1: AUTHENTICATION & PROFILE ---');
  // 1. Register User 1
  await new Promise((resolve) => {
    c1.once('registerSuccess', () => {
      assert(true, 'User 1 registered successfully');
      resolve();
    });
    c1.emit('register', { email: 'alice@example.com', username: 'Alice', password: 'password123' });
  });

  // 2. Reject duplicate email
  await new Promise((resolve) => {
    c2.once('error', (msg) => {
      assert(msg === 'Email already in use', 'Rejects duplicate email');
      resolve();
    });
    c2.emit('register', { email: 'alice@example.com', username: 'Alice2', password: 'password123' });
  });

  // 3. Reject duplicate username
  await new Promise((resolve) => {
    c2.once('error', (msg) => {
      assert(msg === 'Username already exists', 'Rejects duplicate username');
      resolve();
    });
    c2.emit('register', { email: 'bob@example.com', username: 'Alice', password: 'password123' });
  });

  // 4. Login with incorrect password
  await new Promise((resolve) => {
    c1.once('error', (msg) => {
      assert(msg === 'Incorrect password', 'Rejects incorrect password');
      resolve();
    });
    c1.emit('login', { username: 'Alice', password: 'wrongpassword' });
  });

  // 5. Login with correct password
  await new Promise((resolve) => {
    c1.once('authSuccess', (data) => {
      assert(data.username === 'Alice' && data.points === 1000, 'Successful login returns username & 1000 points');
      resolve();
    });
    c1.emit('login', { username: 'Alice', password: 'password123' });
  });

  // 6. Request password reset
  await new Promise((resolve) => {
    c1.once('passwordResetRequested', (data) => {
      assert(data.email === 'alice@example.com', 'Password reset code requested');
      resolve();
    });
    c1.emit('requestPasswordReset', { email: 'alice@example.com' });
  });

  // 7. Reset password with code
  await new Promise((resolve) => {
    c1.once('passwordResetSuccess', () => {
      assert(true, 'Password reset successful with verification code');
      resolve();
    });
    c1.emit('resetPassword', { email: 'alice@example.com', code: '123456', newPassword: 'newpassword456' });
  });

  // 8. Login with new password
  await new Promise((resolve) => {
    c1.once('authSuccess', (data) => {
      assert(data.username === 'Alice', 'Login successful with updated password');
      resolve();
    });
    c1.emit('login', { username: 'Alice', password: 'newpassword456' });
  });

  // 9. Update profile username
  await new Promise((resolve) => {
    c1.once('profileUpdated', (data) => {
      assert(data.username === 'AlicePro', 'Profile updated from Alice to AlicePro');
      resolve();
    });
    c1.emit('updateProfile', { oldUsername: 'Alice', newUsername: 'AlicePro' });
  });

  console.log('\n--- TEST GROUP 2: ROOM CREATION & LOBBY MANAGEMENT ---');
  // 10. Register Bob
  await new Promise((resolve) => {
    c2.once('registerSuccess', resolve);
    c2.emit('register', { email: 'bob@example.com', username: 'Bob', password: 'password123' });
  });

  // 11. Create Multiplayer Room by AlicePro
  let testRoomId = '';
  await new Promise((resolve) => {
    c1.once('roomCreated', (id) => {
      testRoomId = id;
      assert(typeof id === 'string' && id.length === 6, `Multiplayer Room created with ID: ${id}`);
      resolve();
    });
    c1.emit('createRoom', { name: 'AlicePro', isSinglePlayer: false });
  });

  // 12. Update Room Settings
  await new Promise((resolve) => {
    c1.once('roomState', (state) => {
      assert(state.settings.piecesPerPlayer === 6 && state.settings.tiebreakerMode === 'rps', 'Host successfully updated settings (pieces: 6, tiebreaker: rps)');
      resolve();
    });
    c1.emit('updateSettings', {
      roomId: testRoomId,
      settings: { piecesPerPlayer: 6, tiebreakerMode: 'rps', diceCount: 2, diceSides: 6 }
    });
  });

  // 13. Bob joins room
  await new Promise((resolve) => {
    c2.once('roomState', (state) => {
      assert(Object.keys(state.players).length === 2, 'Bob joined room. Player count is 2.');
      resolve();
    });
    c2.emit('joinRoom', { roomId: testRoomId, name: 'Bob' });
  });

  // 14. Non-host cannot update settings
  await new Promise((resolve) => {
    c2.emit('updateSettings', { roomId: testRoomId, settings: { piecesPerPlayer: 20 } });
    setTimeout(() => {
      assert(rooms[testRoomId].settings.piecesPerPlayer === 6, 'Non-host settings update rejected');
      resolve();
    }, 100);
  });

  // 15. Ready Up toggle
  await new Promise((resolve) => {
    c2.once('roomState', (state) => {
      const bobPlayer = Object.values(state.players).find(p => p.name === 'Bob');
      assert(bobPlayer.lobbyReady === true, 'Bob successfully readied up in lobby');
      resolve();
    });
    c2.emit('toggleLobbyReady', { roomId: testRoomId });
  });

  await new Promise((resolve) => {
    c1.once('roomState', (state) => {
      const alicePlayer = Object.values(state.players).find(p => p.name === 'AlicePro');
      assert(alicePlayer.lobbyReady === true, 'AlicePro readied up in lobby');
      resolve();
    });
    c1.emit('toggleLobbyReady', { roomId: testRoomId });
  });

  // 16. Start Game -> SETUP state
  await new Promise((resolve) => {
    c1.once('roomState', (state) => {
      assert(state.state === 'SETUP', 'Game transitioned from LOBBY to SETUP');
      resolve();
    });
    c1.emit('startGame', { roomId: testRoomId });
  });

  console.log('\n--- TEST GROUP 3: BOARD PIECE PLACEMENT ---');
  // 17. Placement submission validation
  // Invalid placement (sum doesn't match piecesPerPlayer=6)
  c1.emit('setPlacement', { roomId: testRoomId, placement: { 2: 2, 3: 1 } }); // only 3 pieces
  await new Promise(r => setTimeout(r, 100));
  assert(rooms[testRoomId].players[c1.id].ready === false, 'Invalid piece count placement rejected');

  // Valid placement for Alice (6 pieces: 7: 3, 6: 2, 8: 1)
  const alicePlacement = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 2, 7: 3, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0 };
  c1.emit('setPlacement', { roomId: testRoomId, placement: alicePlacement });
  await new Promise(r => setTimeout(r, 100));
  assert(rooms[testRoomId].players[c1.id].ready === true, 'Alice locked in valid placement (6 pieces)');

  // 18. Unready placement (edit board)
  await new Promise((resolve) => {
    c1.once('roomState', (state) => {
      assert(state.players[c1.id].ready === false, 'Alice successfully unreadied placement to edit board');
      resolve();
    });
    c1.emit('unreadyPlacement', { roomId: testRoomId });
  });

  // Re-lock in placement for Alice
  c1.emit('setPlacement', { roomId: testRoomId, placement: alicePlacement });
  await new Promise(r => setTimeout(r, 100));

  // Lock in placement for Bob -> Transitions to PLAYING
  const bobPlacement = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 4, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0 };
  await new Promise((resolve) => {
    c1.once('roomState', (state) => {
      assert(state.state === 'PLAYING', 'All players locked in -> Game transitioned to PLAYING');
      resolve();
    });
    c2.emit('setPlacement', { roomId: testRoomId, placement: bobPlacement });
  });

  console.log('\n--- TEST GROUP 4: GAMEPLAY & ROLLING DICE ---');
  // 19. Rolling dice via hostForceRoll
  await new Promise((resolve) => {
    c1.once('diceRolled', (res) => {
      assert(res.rolled === true && typeof res.sum === 'number' && res.sum >= 2 && res.sum <= 12, `Dice rolled: sum=${res.sum}, details=[${res.details}]`);
      resolve();
    });
    c1.emit('hostForceRoll', { roomId: testRoomId });
  });

  assert(rooms[testRoomId].history.length === 1, 'Game history records dice rolls');

  console.log('\n--- TEST GROUP 5: SINGLE PLAYER & AI BEHAVIOR ---');
  // 20. Create single player room with AI
  const c3 = createClient();
  await new Promise(r => c3.on('connect', r));

  let spRoomId = '';
  await new Promise((resolve) => {
    c3.once('roomCreated', (id) => {
      spRoomId = id;
      resolve();
    });
    c3.emit('createRoom', { name: 'SoloPlayer', isSinglePlayer: true });
  });

  const spRoom = rooms[spRoomId];
  const aiPlayerKey = Object.keys(spRoom.players).find(k => spRoom.players[k].isAI);
  assert(spRoom.isSinglePlayer && !!aiPlayerKey, 'Single Player room created with AI player');

  // Ready and Start single player room
  c3.emit('toggleLobbyReady', { roomId: spRoomId });
  await new Promise(r => setTimeout(r, 50));
  c3.emit('startGame', { roomId: spRoomId });
  await new Promise(r => setTimeout(r, 50));

  assert(spRoom.state === 'SETUP', 'Single player game transitioned to SETUP');
  assert(spRoom.players[aiPlayerKey].ready === true, 'AI automatically placed pieces and readied up');
  const aiTotalPieces = Object.values(spRoom.players[aiPlayerKey].pieces).reduce((a, b) => a + b, 0);
  assert(aiTotalPieces === spRoom.settings.piecesPerPlayer, `AI placed exact pieces count (${aiTotalPieces})`);

  console.log('\n--- TEST GROUP 6: TIEBREAKER MODES & SECRET MOVE MASKING ---');
  // 21. RPS Tiebreaker secret move masking
  const testRoomRps = new Room('TEST_RPS');
  testRoomRps.settings.tiebreakerMode = 'rps';
  testRoomRps.state = 'TIEBREAKER';
  testRoomRps.players = {
    'p1': { name: 'Player1', isAI: false, totalPieces: 0 },
    'p2': { name: 'Player2', isAI: false, totalPieces: 0 }
  };
  testRoomRps.tiebreaker = {
    tiedPlayers: ['p1', 'p2'],
    scores: { 'p1': 0, 'p2': 0 },
    flips: [],
    currentFlips: {},
    round: 1
  };

  // Player 1 picks rock
  testRoomRps.playTiebreaker('p1', 'rock');
  const maskedState = testRoomRps.getState();
  assert(maskedState.tiebreaker.currentFlips['p1'] === 'READY', 'RPS uncompleted round masks opponent move as "READY"');

  // Player 2 picks scissors -> round finishes -> rock beats scissors -> Player 1 scores!
  const roundRes = testRoomRps.playTiebreaker('p2', 'scissors');
  assert(roundRes.roundComplete === true, 'RPS round completed when all tied players move');
  assert(testRoomRps.tiebreaker.scores['p1'] === 1 && testRoomRps.tiebreaker.scores['p2'] === 0, 'RPS logic: Rock beats Scissors (P1 score: 1, P2 score: 0)');

  // 22. Coin Flip Tiebreaker
  const testRoomCoin = new Room('TEST_COIN');
  testRoomCoin.settings.tiebreakerMode = 'coin';
  testRoomCoin.state = 'TIEBREAKER';
  testRoomCoin.players = {
    'c1': { name: 'CoinP1', isAI: false, totalPieces: 0 },
    'c2': { name: 'CoinP2', isAI: false, totalPieces: 0 }
  };
  testRoomCoin.tiebreaker = {
    tiedPlayers: ['c1', 'c2'],
    scores: { 'c1': 0, 'c2': 0 },
    flips: [],
    currentFlips: {},
    round: 1
  };
  testRoomCoin.playTiebreaker('c1', 'H');
  testRoomCoin.playTiebreaker('c2', 'T');
  assert(testRoomCoin.tiebreaker.flips.length === 1, 'Coin flip round completed and recorded in flips');

  console.log('\n--- TEST GROUP 7: PROBABILITY & PMF LIB ---');
  const prob = require('../client/src/lib/probability');
  const pmf2d6 = prob.calculatePMF(2, 6);
  assert(pmf2d6.length === 11, 'calculatePMF for 2d6 produces 11 sums (2 to 12)');
  const sumProb = pmf2d6.reduce((a, b) => a + b.probability, 0);
  assert(Math.abs(sumProb - 1.0) < 0.0001, 'PMF total probabilities sum to 1.0');
  const optimalPlacement = prob.getOptimalPlacement(2, 6, 12);
  const totalOptimal = Object.values(optimalPlacement).reduce((a, b) => a + b, 0);
  assert(totalOptimal === 12, 'getOptimalPlacement distributes exact requested piece count');

  // Cleanup
  c1.disconnect();
  c2.disconnect();
  c3.disconnect();
  server.close();

  console.log(`\n==================================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
