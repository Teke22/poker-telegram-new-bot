export function initSocket(socket, state, onReady) {
  let initialized = false;

  function ready() {
    if (initialized) return;
    initialized = true;
    onReady();
  }

  socket.on('connect', () => {
    console.log('🟢 socket.io connected');
    ready();
  });

  socket.on('connected', () => {
    console.log('🟢 server confirmed connection');
    ready();
  });

  socket.on('disconnect', () => {
    console.log('🔴 socket disconnected');
  });
}
