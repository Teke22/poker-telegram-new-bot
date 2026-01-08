require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const RoomManager = require('./rooms/roomManager');

const app = express();
const server = http.createServer(app);

/* ---------------- Socket.IO ---------------- */

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const roomManager = new RoomManager();

/* ---------------- Middleware ---------------- */

app.use(cors());
app.use(express.json());

/* ---------------- Static Mini App ---------------- */

app.use(express.static('../frontend'));

/* ---------------- Health check ---------------- */

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ---------------- Telegram auth verify ---------------- */

function verifyTelegramData(initData) {
  const secret = crypto
    .createHash('sha256')
    .update(process.env.BOT_TOKEN)
    .digest();

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  return hmac === hash;
}

/* ---------------- Socket events ---------------- */

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  /* ---------- AUTH ---------- */
  socket.on('auth', ({ initData }) => {
    try {
      if (!verifyTelegramData(initData)) {
        console.log('❌ Invalid Telegram auth');
        socket.disconnect();
        return;
      }

      const params = new URLSearchParams(initData);
      const user = JSON.parse(params.get('user'));

      socket.user = user;

      console.log(`🟢 ${user.first_name} (${user.id}) authenticated`);
    } catch (err) {
      console.error('Auth error:', err);
      socket.disconnect();
    }
  });

  /* ---------- CREATE ROOM ---------- */
  socket.on('create_room', () => {
    if (!socket.user) return;

    const room = roomManager.createRoom(socket.user);

    socket.join(room.code);
    socket.emit('room_update', room);

    console.log(`🏠 Room created: ${room.code}`);
  });

  /* ---------- JOIN ROOM ---------- */
  socket.on('join_room', (code) => {
    try {
      if (!socket.user) return;

      const room = roomManager.joinRoom(code, socket.user);

      socket.join(room.code);
      io.to(room.code).emit('room_update', room);

      console.log(`➕ ${socket.user.first_name} joined room ${code}`);
    } catch (err) {
      socket.emit('error_message', err.message);
    }
  });

  /* ---------- DISCONNECT ---------- */
  socket.on('disconnect', () => {
    if (socket.user) {
      roomManager.removeUserFromRooms(socket.user.id);
      console.log(`🔴 ${socket.user.first_name} disconnected`);
    } else {
      console.log('🔴 Socket disconnected:', socket.id);
    }
  });
});

/* ---------------- Start server ---------------- */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
