export function showRoom(state) {
  const app = document.getElementById('app');
  const room = state.room;

  app.innerHTML = `
    <h2 style="text-align:center;">Комната ${room.code}</h2>

    <div>
      ${room.players.map(p => `
        <div>${p.name} — 💰 ${p.chips}</div>
      `).join('')}
    </div>

    <button id="startGameBtn">Начать игру</button>
    <button id="leaveBtn">Выйти</button>
  `;

  document.getElementById('startGameBtn').onclick = () => {
    state.socket.emit('start_game', { code: room.code });
  };

  document.getElementById('leaveBtn').onclick = () => {
    state.socket.emit('leave_room', {
      code: room.code,
      playerId: state.me.id
    });
    state.room = null;
    showLobby(state);
  };
}
