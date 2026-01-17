const statusEl = document.getElementById('status');
statusEl.innerText = 'Подключение к игре…';

const socket = io();

// глобальное состояние (как раньше)
const state = {
  socket,
  roomId: null,
  playerId: null,
};

// 🔴 КРИТИЧНО: без этого UI не обновляется
socket.on('connected', () => {
  console.log('✅ connected to server');
  statusEl.innerText = '🎮 Подключено';

  showLobby();
});

// fallback — если сервер не прислал событие
socket.on('connect', () => {
  console.log('⚠ socket.io connect');
  statusEl.innerText = '🎮 Подключено';
  showLobby();
});

// ---------- UI ----------

function showLobby() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="lobby">
      <button id="createRoom">Создать комнату</button>
      <input id="roomInput" placeholder="ID комнаты" />
      <button id="joinRoom">Войти</button>
    </div>
  `;

  document.getElementById('createRoom').onclick = () => {
    socket.emit('room:create');
  };

  document.getElementById('joinRoom').onclick = () => {
    const roomId = document.getElementById('roomInput').value.trim();
    if (roomId) {
      socket.emit('room:join', roomId);
    }
  };
}

// ---------- SOCKET EVENTS ----------

socket.on('room:created', ({ roomId, playerId }) => {
  state.roomId = roomId;
  state.playerId = playerId;
  showRoom();
});

socket.on('room:joined', ({ roomId, playerId }) => {
  state.roomId = roomId;
  state.playerId = playerId;
  showRoom();
});

socket.on('error', msg => {
  alert(msg);
});

// ---------- ROOM ----------

function showRoom() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="room">
      <h3>Комната: ${state.roomId}</h3>
      <p>Ожидание игроков…</p>
    </div>
  `;
}
