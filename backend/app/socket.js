const { Server } = require('socket.io');
const RoomManager = require('../rooms/RoomManager');

module.exports = function setupSocket(server) {
  const io = new Server(server, { cors: { origin: '*' } });
  const rooms = new RoomManager(io);

  io.on('connection', socket => {
    rooms.bindSocket(socket);
  });
};
