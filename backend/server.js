require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');
const config = require('./config');

const app = express();
const server = http.createServer(app);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= FRONTEND ================= */
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ================= ROOMS ================= */
const rooms = {};        // code -> room
const userSockets = {};  // userId -> socketId

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms[code] ? generateRoomCode() : code;
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (!room) return;

  if (room.players.length === 0) {
    delete rooms[code];
    console.log(`🗑️ Room ${code} deleted`);
  }
}

/* ================= GAME FLOW ================= */

function startNewHand(room) {
  console.log(`🔄 Starting new hand in ${room.code}`);

  const alivePlayers = room.players.filter(p => p.chips > 0);
  if (alivePlayers.length < 2) {
    console.log('❌ Not enough players with chips');
    room.game = null;
    io.to(room.code).emit('room_update', room);
    return;
  }

  room.game = new GameState(
    room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips
    }))
  );

  const started = room.game.startGame();
  if (!started) {
    room.game = null;
    return;
  }

  // Send private cards
  room.players.forEach(p => {
    const socketId = userSockets[p.id];
    const privateState = room.game.getPlayerPrivateState(p.id);
    if (socketId && privateState) {
      io.to(socketId).emit('my_cards', privateState.hand);
    }
  });

  io.to(room.code).emit('game_started', {
    publicState: room.game.getPublicState()
  });
}

/* ================= SOCKET EVENTS ================= */

io.on('connection', socket => {
  console.log('🔌 Connected:', socket.id);

  socket.on('disconnect', () => {
    let userId = null;

    for (const [uid, sid] of Object.entries(userSockets)) {
      if (sid === socket.id) {
        userId = uid;
        delete userSockets[uid];
        break;
      }
    }

    if (!userId) return;

    for (const [code, room] of Object.entries(rooms)) {
      const player = room.players.find(p => p.id === userId);
      if (!player) continue;

      console.log(`⚠️ ${player.name} disconnected`);

      if (room.game) {
        room.game.playerLeave(userId);
        io.to(code).emit('game_update', room.game.getPublicState());
      }

      setTimeout(() => {
        if (!userSockets[userId] && rooms[code]) {
          room.players = room.players.filter(p => p.id !== userId);
          io.to(code).emit('room_update', room);
          cleanupRoom(code);
        }
      }, 30000);
    }
  });

  /* ---------- ROOMS ---------- */

  socket.on('create_room', ({ user }) => {
    const code = generateRoomCode();
    userSockets[user.id] = socket.id;

    rooms[code] = {
      code,
      players: [{
        id: user.id,
        name: user.first_name || 'Player',
        chips: 1000
      }],
      game: null
    };

    socket.join(code);
    socket.emit('room_joined', rooms[code]);
    io.to(code).emit('room_update', rooms[code]);

    console.log(`🏠 Room ${code} created`);
  });

  socket.on('join_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Room not found');
    if (room.players.length >= 8) return socket.emit('error_msg', 'Room full');

    if (!room.players.find(p => p.id === user.id)) {
      room.players.push({
        id: user.id,
        name: user.first_name || 'Player',
        chips: 1000
      });
    }

    userSockets[user.id] = socket.id;
    socket.join(code);

    socket.emit('room_joined', room);
    io.to(code).emit('room_update', room);
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.players.length < 2) return;

    startNewHand(room);
  });

  /* ---------- GAME ---------- */

  socket.on('player_action', ({ code, playerId, action }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    try {
      room.game.playerAction(playerId, action);
      io.to(code).emit('game_update', room.game.getPublicState());

      if (room.game.finished) {
        room.players.forEach(p => {
          const gp = room.game.players.find(x => x.id === p.id);
          if (gp) p.chips = gp.chips;
        });

        io.to(code).emit('hand_finished', {
          winners: room.game.winners,
          reason: 'finished'
        });

        setTimeout(() => startNewHand(room), config.NEXT_HAND_DELAY);
      }
    } catch (e) {
      socket.emit('error_msg', e.message);
    }
  });

  socket.on('get_my_cards', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const state = room.game.getPlayerPrivateState(playerId);
    if (state) socket.emit('my_cards', state.hand);
  });

  socket.on('leave_room', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    socket.leave(code);

    io.to(code).emit('room_update', room);
    cleanupRoom(code);
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
