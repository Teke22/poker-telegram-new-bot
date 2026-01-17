module.exports = function initSocket(io, roomManager) {
  if (!roomManager) {
    throw new Error('❌ roomManager is not provided to initSocket');
  }

  io.on('connection', socket => {
    console.log('🟢 Socket connected:', socket.id);

    // подтверждение для фронта
    socket.emit('connected');

    // биндим сокет к менеджеру комнат
    roomManager.bindSocket(socket);

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected:', socket.id);
    });
  });
};
