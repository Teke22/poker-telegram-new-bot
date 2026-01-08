require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');

const app = express();
const server = http.createServer(app);

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());

/* ---------------- SOCKET.IO ---------------- */

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ---------------- ROOMS STORAGE ---------------- */

// roomCode -> room object
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

/* ---------------- SOCKET EVENTS ---------------- */

io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);

  /* ----- CREATE ROOM ----- */
  socket.on('create_room', ({ user }) => {
    const code = generateRoomCode();

    rooms[code] = {
      code,
      hostId: user.id,
      players: [
        {
          id: user.id,
          name: user.name,
          chips: 1000
        }
      ],
      game: null
    };

    socket.join(code);

    socket.emit('room_joined', rooms[code]);
    io.to(code).emit('room_update', rooms[code]);

    console.log(`🏠 Room created: ${code}`);
  });

  /* ----- JOIN ROOM ----- */
  socket.on('join_room', ({ code, user }) => {
    const room = rooms[code];

    if (!room) {
      socket.emit('error_msg', 'Комната не найдена');
      return;
    }

    // защита от дублей
    if (room.players.find(p => p.id === user.id)) return;

    room.players.push({
      id: user.id,
      name: user.name,
      chips: 1000
    });

    socket.join(code);

    io.to(code).emit('room_update', room);

    console.log(`➕ ${user.name} joined room ${code}`);
  });

  /* ----- START GAME ----- */
  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room) return;

    if (room.players.length < 2) {
      socket.emit('error_msg', 'Нужно минимум 2 игрока');
      return;
    }

    room.game = new GameState(
      room.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
      }))
    );

    room.game.startGame();

    io.to(code).emit('game_started', {
      publicState: room.game.getPublicState()
    });

    console.log(`🎮 Game started in room ${code}`);
  });

  /* ----- GET PRIVATE CARDS ----- */
  socket.on('get_my_cards', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const privateState = room.game.getPlayerPrivateState(playerId);
    if (!privateState) return;

    socket.emit('my_cards', privateState.hand);
  });

  /* ----- DISCONNECT ----- */
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

/* ---------------- BASIC ROUTES ---------------- */

app.get('/', (req, res) => {
  res.send('Poker Telegram backend is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
