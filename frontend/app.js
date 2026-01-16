const tg = window.Telegram?.WebApp;

// Инициализируем пользователя
let me;
if (tg && tg.initDataUnsafe?.user) {
  const user = tg.initDataUnsafe.user;
  me = {
    id: String(user.id),
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    name: '',
    chips: 1000
  };
} else {
  const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  me = {
    id: 'debug_' + randomId,
    username: null,
    first_name: null,
    last_name: null,
    name: '',
    chips: 1000
  };
}

const socket = io({ transports: ['websocket'] });

let room = null;
let myCards = [];
let gameState = null;
let showWinnersTimeout = null;
let winnersShown = false;
let hasNickname = false;

// ============= INITIALIZATION =============

function initializeApp() {
  document.getElementById('app').innerHTML = `
    <div style="text-align:center; padding:50px;">
      <h2 style="color:#2ecc71;">🎴 POKER ROYALE</h2>
      <p style="color:#bdc3c7;">Загрузка...</p>
    </div>
  `;
  
  // Проверяем ник после подключения
  setTimeout(() => {
    socket.emit('check_nickname_on_enter', { user: me });
  }, 500);
}

// ============= MAIN UI FUNCTIONS =============

function showNicknameDialog(forceShow = false) {
  document.getElementById('app').innerHTML = getNicknameDialogHTML(me, forceShow);
  updateStatus('Выберите никнейм для игры');
  
  // Фокусируемся на поле ввода
  setTimeout(() => {
    const input = document.getElementById('nicknameInput');
    if (input) {
      input.focus();
      if (me.name && !forceShow) {
        input.value = me.name;
      }
    }
  }, 100);
}

function showLobby() {
  document.getElementById('app').innerHTML = getLobbyHTML(me);
  updateStatus(`Добро пожаловать${me.name ? ', ' + me.name : ''}! Выберите действие`);
}

function showRoom() {
  if (!room) return;
  document.getElementById('app').innerHTML = getRoomHTML(room, me);
  updateStatus(`Вы в комнате ${room.code} | Игроков: ${room.players.length} | Ваш ник: ${me.name}`);
}

function showGame() {
  if (!gameState) return;
  
  const meInGame = gameState.players.find(p => p.id === me.id);
  const isMyTurn = gameState.currentPlayerId === me.id && !gameState.finished && !meInGame?.allIn;
  const isAllIn = meInGame?.allIn;
  
  if (meInGame) {
    me.chips = meInGame.chips;
  }
  
  document.getElementById('app').innerHTML = getGameHTML(gameState, room, me, myCards, isMyTurn, isAllIn);
  
  // Обновляем статус
  if (isMyTurn) {
    const meInGame = gameState.players.find(p => p.id === me.id);
    const toCall = gameState.currentBet - (meInGame?.bet || 0);
    updateStatus(`🎯 ВАШ ХОД! Стадия: ${getStageName(gameState.stage)} | Банк: ${gameState.pot} | Нужно коллировать: ${toCall}`);
  } else if (isAllIn && !gameState.finished) {
    updateStatus(`⚡ ВЫ НА ALL-IN | Ожидание завершения раздачи...`);
  } else if (gameState.finished) {
    if (gameState.winners && gameState.winners.length > 0 && !winnersShown) {
      updateStatus(`🏆 ШОУДАУН! Определение победителя...`);
      winnersShown = true;
      clearTimeout(showWinnersTimeout);
      showWinnersTimeout = setTimeout(() => {
        updateStatus(`🏆 РАЗДАЧА ЗАВЕРШЕНА! Победитель: ${gameState.winners[0].name}`);
      }, 5000);
    } else {
      updateStatus(`🏆 РАЗДАЧА ЗАВЕРШЕНА! Победитель: ${gameState.winners[0]?.name || 'Не определен'}`);
    }
  } else {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    updateStatus(`⏳ Ходит: ${getPlayerDisplayName(currentPlayer || {name: '...'})} | Банк: ${gameState.pot}`);
  }
  
  // Если наша очередь, обновляем действия
  if (isMyTurn) {
    setTimeout(updateActions, 100);
  }
}

// ============= GAME ACTIONS =============

function createRoom() {
  socket.emit('create_room', { user: me });
  updateStatus('Создание комнаты...');
}

function joinRoom() {
  const code = document.getElementById('code').value.trim().toUpperCase();
  if (!code) {
    alert('Введите код комнаты');
    return;
  }
  socket.emit('join_room', { code, user: me });
  updateStatus('Присоединение к комнате...');
}

function leaveRoom() {
  if (!room) return;
  if (confirm('Вы уверены, что хотите покинуть комнату?')) {
    socket.emit('leave_room', { code: room.code, playerId: me.id });
    room = null;
    gameState = null;
    myCards = [];
    winnersShown = false;
    clearTimeout(showWinnersTimeout);
    showLobby();
  }
}

function startGame() {
  if (!room) return;
  winnersShown = false;
  clearTimeout(showWinnersTimeout);
  socket.emit('start_game', { code: room.code });
  updateStatus('Запуск игры...');
}

function startNewHand() {
  if (!room) return;
  winnersShown = false;
  clearTimeout(showWinnersTimeout);
  socket.emit('start_game', { code: room.code });
  updateStatus('Новая раздача...');
}

// Основные действия игрока
function fold() {
  if (!confirm('Вы уверены, что хотите сбросить карты?')) return;
  socket.emit('player_action', {
    code: room.code,
    playerId: me.id,
    action: 'fold'
  });
}

function check() {
  socket.emit('player_action', {
    code: room.code,
    playerId: me.id,
    action: 'check'
  });
}

function call() {
  socket.emit('player_action', {
    code: room.code,
    playerId: me.id,
    action: { type: 'call' }
  });
}

function allIn() {
  const meInGame = gameState?.players.find(p => p.id === me.id);
  if (!meInGame) return;
  
  if (!confirm(`Пойти ALL-IN на ${meInGame.chips} фишек?`)) return;
  socket.emit('player_action', {
    code: room.code,
    playerId: me.id,
    action: { type: 'allin' }
  });
}

// Диалог для ставок/рейзов
let currentDialogType = 'bet';

function showBetDialog(type) {
  currentDialogType = type;
  const meInGame = gameState?.players.find(p => p.id === me.id);
  if (!meInGame) return;
  
  const dialog = document.getElementById('betDialog');
  const overlay = document.getElementById('overlay');
  const input = document.getElementById('amountInput');
  const info = document.getElementById('dialogInfo');
  const title = document.getElementById('dialogTitle');
  
  if (type === 'bet') {
    title.textContent = 'СДЕЛАТЬ СТАВКУ';
    info.innerHTML = `
      <div style="color:#bdc3c7;">
        <div>Минимальная ставка: <strong style="color:#f39c12;">20</strong></div>
        <div>Ваши фишки: <strong style="color:#2ecc71;">${meInGame.chips}</strong></div>
      </div>
    `;
    input.min = 20;
    input.max = meInGame.chips;
    input.value = Math.max(20, Math.min(100, meInGame.chips));
  } else {
    title.textContent = 'СДЕЛАТЬ РЕЙЗ';
    const minRaise = gameState.currentBet + gameState.minRaise;
    info.innerHTML = `
      <div style="color:#bdc3c7;">
        <div>Текущая ставка: <strong style="color:#e74c3c;">${gameState.currentBet}</strong></div>
        <div>Минимальный рейз: <strong style="color:#f39c12;">${minRaise}</strong></div>
        <div>Ваши фишки: <strong style="color:#2ecc71;">${meInGame.chips}</strong></div>
      </div>
    `;
    input.min = minRaise;
    input.max = meInGame.chips + meInGame.bet;
    input.value = minRaise;
  }
  
  dialog.style.display = 'block';
  overlay.style.display = 'block';
  setTimeout(() => input.focus(), 100);
}

function hideBetDialog() {
  document.getElementById('betDialog').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

function submitBet() {
  const amount = parseInt(document.getElementById('amountInput').value);
  if (isNaN(amount) || amount <= 0) {
    alert('Введите корректную сумму');
    return;
  }
  
  socket.emit('player_action', {
    code: room.code,
    playerId: me.id,
    action: { type: currentDialogType, amount: amount }
  });
  
  hideBetDialog();
}

// ============= UTILITY FUNCTIONS =============

function updateStatus(text) {
  document.getElementById('status').innerText = text;
}

function getTelegramFallbackName() {
  if (tg && tg.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    if (user.username) return `@${user.username}`;
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.first_name) return user.first_name;
  }
  return `Игрок_${String(me.id).slice(-4)}`;
}

function setNickname() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const errorEl = document.getElementById('nicknameError');
  
  if (!nickname) {
    errorEl.textContent = 'Введите никнейм';
    return;
  }
  
  if (nickname.length < 3) {
    errorEl.textContent = 'Никнейм должен быть не менее 3 символов';
    return;
  }
  
  if (nickname.length > 15) {
    errorEl.textContent = 'Никнейм должен быть не более 15 символов';
    return;
  }
  
  socket.emit('set_nickname', { nickname, user: me });
}

function generateRandomNickname() {
  socket.emit('generate_nickname', { user: me });
}

function skipNickname() {
  showLobby();
}

function forceSkipNickname() {
  me.name = getTelegramFallbackName();
  hasNickname = false;
  showLobby();
}

function updateActions() {
  if (!gameState) return;
  
  const meInGame = gameState.players.find(p => p.id === me.id);
  if (!meInGame || meInGame.folded || meInGame.allIn) return;
  
  const toCall = gameState.currentBet - meInGame.bet;
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && meInGame.chips >= toCall;
  const canBet = gameState.currentBet === 0 && meInGame.chips > 0;
  const canRaise = meInGame.chips > toCall && toCall < meInGame.chips;
  
  const actionsContainer = document.getElementById('actionsContainer');
  if (!actionsContainer) return;
  
  actionsContainer.innerHTML = getGameActionsHTML(toCall, canCheck, canCall, canBet, canRaise, meInGame, gameState);
}

// ============= SOCKET HANDLERS =============

socket.on('connect', () => {
  console.log('Connected to server');
  updateStatus('✅ Подключено к серверу');
});

socket.on('disconnect', () => {
  updateStatus('❌ Соединение потеряно. Переподключение...');
});

socket.on('nickname_check_result', (data) => {
  console.log('Nickname check result:', data);
  
  if (data.nickname) {
    me.name = data.nickname;
    hasNickname = true;
    showLobby();
  } else if (data.displayName) {
    me.name = data.displayName;
    hasNickname = false;
    if (!me.username) {
      showNicknameDialog(true);
    } else {
      showLobby();
    }
  } else {
    showNicknameDialog(true);
  }
});

socket.on('nickname_set', (data) => {
  if (data.success) {
    me.name = data.nickname;
    hasNickname = true;
    showLobby();
  } else {
    document.getElementById('nicknameError').textContent = data.error;
  }
});

socket.on('nickname_info', (data) => {
  if (data.nickname) {
    me.name = data.nickname;
    hasNickname = true;
  }
  showLobby();
});

socket.on('nickname_generated', (data) => {
  if (data.nickname) {
    document.getElementById('nicknameInput').value = data.nickname;
    document.getElementById('nicknameError').textContent = '';
  } else if (data.error) {
    document.getElementById('nicknameError').textContent = data.error;
  }
});

socket.on('room_joined', (r) => {
  console.log('Room joined:', r);
  room = r;
  showRoom();
});

socket.on('room_update', (r) => {
  console.log('Room updated:', r);
  room = r;
  if (!gameState) {
    showRoom();
  }
});

socket.on('game_started', ({ publicState }) => {
  console.log('Game started:', publicState);
  gameState = publicState;
  myCards = [];
  winnersShown = false;
  clearTimeout(showWinnersTimeout);
  
  setTimeout(() => {
    socket.emit('get_my_cards', {
      code: room.code,
      playerId: me.id
    });
  }, 500);
  
  showGame();
});

socket.on('game_update', (state) => {
  console.log('Game updated:', state);
  gameState = state;
  showGame();
});

socket.on('my_cards', (cards) => {
  console.log('Received my cards:', cards);
  myCards = cards;
  if (gameState) {
    showGame();
  }
});

socket.on('error_msg', (msg) => {
  console.error('Server error:', msg);
  alert('❌ Ошибка: ' + msg);
});

socket.on('hand_finished', (data) => {
  console.log('Hand finished:', data);
  if (gameState) {
    gameState.finished = true;
    gameState.winners = data.winners || [];
    showGame();
  }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initializeApp);