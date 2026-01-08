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

// путь к папке frontend
const frontendPath = path.join(__dirname, '..', 'frontend');

// раздаём frontend как статические файлы
app.use(express.static(frontendPath));

// если открывают /
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
      hostId: user.id,
      players: [{ id: user.id, name: user.name, chips: 1000 }],
      game: null
    };

    socket.join(code);
    socket.emit('room_joined', rooms[code]);
    io.to(code).emit('room_update', rooms[code]);
  });

  socket.on('join_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Комната не найдена');

    if (room.players.find(p => p.id === user.id)) return;

    room.players.push({ id: user.id, name: user.name, chips: 1000 });
    socket.join(code);

    io.to(code).emit('room_update', room);
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.players.length < 2) return;

    room.game = new GameState(room.players);
    room.game.startGame();

    io.to(code).emit('game_started', {
      publicState: room.game.getPublicState()
    });
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
