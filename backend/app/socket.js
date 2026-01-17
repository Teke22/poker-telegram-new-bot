module.exports = function initSocket(io, roomManager) {
  io.on('connection', socket => {
    console.log('🟢 Socket connected:', socket.id);

    // 🔴 ВАЖНО: без этого фронт "висит"
    socket.emit('connected');

    // старая логика
    roomManager.bindSocket(socket);

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected:', socket.id);
    });
  });
};
