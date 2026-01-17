export function showLobby(state) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <h1 style="color:#2ecc71;">🎴 POKER ROYALE</h1>

      <button id="createRoomBtn"
        style="padding:15px 30px; font-size:18px; margin-top:30px;">
        🎮 СОЗДАТЬ КОМНАТУ
      </button>
    </div>
  `;

  document.getElementById('createRoomBtn').onclick = () => {
    state.socket.emit('create_room', { user: state.me });
  };
}
