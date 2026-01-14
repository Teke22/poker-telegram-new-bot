require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');
const config = require('./config');

const app = express();
const server = http.createServer(app);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= FRONTEND ================= */
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ================= ROOMS ================= */
const rooms = {};        // code -> room
const userSockets = {};  // userId -> socketId

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms[code] ? generateRoomCode() : code;
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (!room) return;

  if (room.players.length === 0) {
    delete rooms[code];
    console.log(`🗑️ Room ${code} deleted`);
  }
}

// Функция для получения отображаемого имени из Telegram user объекта
function getTelegramDisplayName(user) {
  // Проверяем, что user объект существует
  if (!user) return 'Player';
  
  // Если есть username, используем его
  if (user.username) {
    return `@${user.username}`;
  }
  
  // Если есть first_name и last_name
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  
  // Если только first_name
  if (user.first_name) {
    return user.first_name;
  }
  
  // Если ничего нет, используем ID
  if (user.id) {
    return `User_${String(user.id).slice(-4)}`;
  }
  
  // Fallback
  return 'Player';
}

/* ================= GAME FLOW ================= */

function startNewHand(room) {
  console.log(`🔄 Starting new hand in ${room.code}`);

  const alivePlayers = room.players.filter(p => p.chips > 0);
  if (alivePlayers.length < 2) {
    console.log('❌ Not enough players with chips');
    room.game = null;
    io.to(room.code).emit('room_update', room);
    return;
  }

  room.game = new GameState(
    room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips
    }))
  );

  const started = room.game.startGame();
  if (!started) {
    room.game = null;
    return;
  }

  // Отправляем приватные карты
  room.players.forEach(p => {
    const socketId = userSockets[p.id];
    const privateState = room.game.getPlayerPrivateState(p.id);
    if (socketId && privateState) {
      io.to(socketId).emit('my_cards', privateState.hand);
    }
  });

  // Отправляем доступные действия текущему игроку
  const currentPlayerId = room.game.getPublicState().currentPlayerId;
  const currentPlayerSocket = userSockets[currentPlayerId];
  if (currentPlayerSocket) {
    const availableActions = room.game.getAvailableActions(currentPlayerId);
    io.to(currentPlayerSocket).emit('available_actions', availableActions);
  }

  io.to(room.code).emit('game_started', {
    publicState: room.game.getPublicState()
  });
}

/* ================= SOCKET EVENTS ================= */

io.on('connection', socket => {
  console.log('🔌 Connected:', socket.id);

  socket.on('disconnect', () => {
    let userId = null;

    for (const [uid, sid] of Object.entries(userSockets)) {
      if (sid === socket.id) {
        userId = uid;
        delete userSockets[uid];
        break;
      }
    }

    if (!userId) return;

    for (const [code, room] of Object.entries(rooms)) {
      const player = room.players.find(p => p.id === userId);
      if (!player) continue;

      console.log(`⚠️ ${player.name} disconnected`);

      if (room.game) {
        // Если у GameState есть метод playerLeave, используем его
        if (room.game.playerLeave) {
          room.game.playerLeave(userId);
        }
        io.to(code).emit('game_update', room.game.getPublicState());
      }

      setTimeout(() => {
        if (!userSockets[userId] && rooms[code]) {
          room.players = room.players.filter(p => p.id !== userId);
          io.to(code).emit('room_update', room);
          cleanupRoom(code);
        }
      }, 30000);
    }
  });

  /* ---------- ROOMS ---------- */

  socket.on('create_room', ({ user }) => {
    const code = generateRoomCode();
    userSockets[user.id] = socket.id;

    // Получаем имя из Telegram user объекта
    const displayName = getTelegramDisplayName(user);
    
    rooms[code] = {
      code,
      players: [{
        id: user.id,
        name: displayName, // Используем правильное имя
        chips: 1000
      }],
      game: null
    };

    socket.join(code);
    socket.emit('room_joined', rooms[code]);
    io.to(code).emit('room_update', rooms[code]);

    console.log(`🏠 Room ${code} created by ${displayName}`);
  });

  socket.on('join_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Room not found');
    if (room.players.length >= 8) return socket.emit('error_msg', 'Room full');

    // Получаем имя из Telegram user объекта
    const displayName = getTelegramDisplayName(user);
    
    // Проверяем, есть ли уже игрок в комнате
    const existingPlayer = room.players.find(p => p.id === user.id);
    if (!existingPlayer) {
      room.players.push({
        id: user.id,
        name: displayName, // Используем правильное имя
        chips: 1000
      });
    } else {
      // Если игрок уже есть, обновляем его сокет и имя (на случай если изменилось)
      existingPlayer.name = displayName;
    }

    userSockets[user.id] = socket.id;
    socket.join(code);

    socket.emit('room_joined', room);
    io.to(code).emit('room_update', room);
    
    console.log(`👤 ${displayName} joined room ${code}`);
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.players.length < 2) return;

    startNewHand(room);
  });

  /* ---------- GAME ACTIONS ---------- */

  socket.on('player_action', ({ code, playerId, action }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    try {
      // Валидация действия перед выполнением
      const validation = room.game.validateAction(playerId, action);
      if (!validation.valid) {
        socket.emit('error_msg', validation.error);
        return;
      }

      // Выполняем действие
      room.game.playerAction(playerId, action);
      
      // Отправляем обновленное состояние игры всем
      const publicState = room.game.getPublicState();
      io.to(code).emit('game_update', publicState);

      // Отправляем доступные действия новому текущему игроку
      const currentPlayerId = publicState.currentPlayerId;
      if (currentPlayerId && !publicState.finished) {
        const currentPlayerSocket = userSockets[currentPlayerId];
        if (currentPlayerSocket) {
          const availableActions = room.game.getAvailableActions(currentPlayerId);
          io.to(currentPlayerSocket).emit('available_actions', availableActions);
        }
      }

      // Если игра завершена
      if (room.game.finished) {
        // Обновляем фишки игроков после игры
        room.players.forEach(p => {
          const gp = room.game.players.find(x => x.id === p.id);
          if (gp) p.chips = gp.chips;
        });

        io.to(code).emit('hand_finished', {
          winners: room.game.winners,
          reason: 'finished'
        });

        // Запускаем новую раздачу через 5 секунд
        setTimeout(() => startNewHand(room), config.NEXT_HAND_DELAY || 5000);
      }
    } catch (e) {
      socket.emit('error_msg', e.message);
      console.error('Player action error:', e.message);
    }
  });

  socket.on('get_my_cards', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const state = room.game.getPlayerPrivateState(playerId);
    if (state) socket.emit('my_cards', state.hand);
  });

  socket.on('get_available_actions', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const availableActions = room.game.getAvailableActions(playerId);
    socket.emit('available_actions', availableActions);
  });

  socket.on('validate_action', ({ code, playerId, action }, callback) => {
    const room = rooms[code];
    if (!room || !room.game) {
      if (callback) callback({ valid: false, error: 'Game not found' });
      return;
    }

    const validation = room.game.validateAction(playerId, action);
    if (callback) callback(validation);
  });

  socket.on('leave_room', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      console.log(`🚪 ${player.name} left room ${code}`);
    }

    room.players = room.players.filter(p => p.id !== playerId);
    socket.leave(code);

    io.to(code).emit('room_update', room);
    cleanupRoom(code);
  });

  // Новый обработчик для получения приватного состояния
  socket.on('get_my_private_state', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    const privateState = room.game.getPlayerPrivateState(playerId);
    if (privateState) {
      socket.emit('my_private_state', privateState);
    }
  });

  // Обработчик для восстановления соединения
  socket.on('reconnect_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Room not found');

    const player = room.players.find(p => p.id === user.id);
    if (!player) return socket.emit('error_msg', 'Player not found in room');

    userSockets[user.id] = socket.id;
    socket.join(code);

    // Если игра идет, отправляем состояние игры
    if (room.game) {
      const publicState = room.game.getPublicState();
      socket.emit('game_update', publicState);
      
      const privateState = room.game.getPlayerPrivateState(user.id);
      if (privateState) {
        socket.emit('my_cards', privateState.hand);
        socket.emit('my_private_state', privateState);
        
        // Если сейчас ход этого игрока, отправляем доступные действия
        if (publicState.currentPlayerId === user.id) {
          const availableActions = room.game.getAvailableActions(user.id);
          socket.emit('available_actions', availableActions);
        }
      }
    } else {
      socket.emit('room_joined', room);
    }
  });

  // Обработчик для отладки состояния игры
  socket.on('debug_state', ({ code }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    console.log('=== DEBUG STATE ===');
    room.game.debugState();
    room.game.debugHands();
    
    socket.emit('debug_info', {
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
      })),
      gameState: room.game.getPublicState()
    });
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});