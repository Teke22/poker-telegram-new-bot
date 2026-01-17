export function showLobby(state) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="lobby">
      <button id="createRoom">Создать комнату</button>
      <input id="roomId" placeholder="ID комнаты" />
      <button id="joinRoom">Войти</button>
    </div>
  `;

  document.getElementById('createRoom').onclick = () => {
    state.socket.emit('room:create');
  };

  document.getElementById('joinRoom').onclick = () => {
    const id = document.getElementById('roomId').value.trim();
    if (id) {
      state.socket.emit('room:join', id);
    }
  };
}
