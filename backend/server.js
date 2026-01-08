require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');

const app = express();
const server = http.createServer(app);

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());

/* ---------------- FRONTEND ---------------- */

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ---------------- SOCKET.IO ---------------- */

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ---------------- ROOMS ---------------- */

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);

  socket.on('create_room', ({ user }) => {
    const code = generateRoomCode();

    rooms[code] = {
      code,
      players: [{ id: user.id, name: user.first_name || user.name, chips: 1000 }],
      game: null
    };

    socket.join(code);
    socket.emit('room_joined', rooms[code]);
    io.to(code).emit('room_update', rooms[code]);

    console.log(`🏠 Room ${code} created`);
  });

  socket.on('join_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Комната не найдена');

    if (room.players.find(p => p.id === user.id)) return;

    room.players.push({
      id: user.id,
      name: user.first_name || user.name,
      chips: 1000
    });

    socket.join(code);
    io.to(code).emit('room_update', room);

    console.log(`👤 ${user.first_name} joined ${code}`);
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.players.length < 2) return;

    room.game = new GameState(room.players);
    room.game.startGame();

    io.to(code).emit('game_started', {
      publicState: room.game.getPublicState()
    });

    console.log(`🎮 Game started in ${code}`);
  });

  socket.on('player_action', ({ code, playerId, action }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    try {
      room.game.playerAction(playerId, action);

      io.to(code).emit('game_update', room.game.getPublicState());
    } catch (e) {
      socket.emit('error_msg', e.message);
    }
if (room.game.finished) {
  const winner = room.game.getWinner();

  io.to(code).emit('hand_finished', {
    winner: winner ? { id: winner.id, name: winner.name } : null,
    reason: 'fold'
  });
}
if (room.game.finished) {
  setTimeout(() => {
    room.game.startGame();

    io.to(code).emit('game_started', {
      publicState: room.game.getPublicState()
    });

    console.log('♻️ New hand started in room', code);
  }, 3000);
}


  });

  socket.on('get_my_cards', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const privateState = room.game.getPlayerPrivateState(playerId);
    if (privateState) {
      socket.emit('my_cards', privateState.hand);
    }
  });
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
