require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const RoomManager = require('./rooms/roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const roomManager = new RoomManager();

/* ---------- Middleware ---------- */
app.use(cors());
app.use(express.json());

/* ---------- Static Mini App ---------- */
app.use(express.static('../frontend'));

/* ---------- Health check ---------- */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ---------- Telegram auth verify ---------- */
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

/* ---------- Socket.IO ---------- */
io.on('connection', (socket) => {
  console.log('🔌 Socket connected', socket.id);

  socket.on('auth', ({ initData }) => {
    if (!verifyTelegramData(initData)) {
      console.log('❌ Invalid Telegram auth');
      socket.disconnect();
      return;
    }

    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user'));

    socket.user = user;

    console.log(`🟢 ${user.first_name} (${user.id}) connected`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected', socket.id);
  });
});

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
