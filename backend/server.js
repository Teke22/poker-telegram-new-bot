const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const RoomManager = require('./rooms/RoomManager');
const initSocket = require('./app/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// static frontend (если используется)
app.use(express.static('../frontend'));

// создаём ОДИН экземпляр менеджера
const roomManager = new RoomManager(io);

// 🔴 ВАЖНО: передаём roomManager вторым аргументом
initSocket(io, roomManager);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
