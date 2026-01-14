require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');
const UserManager = require('./userManager');
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

/* ================= MANAGERS ================= */
const userManager = new UserManager();
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

function getDisplayName(user, useFallback = true) {
  return userManager.getDisplayName(user, useFallback);
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

  // Send private cards
  room.players.forEach(p => {
    const socketId = userSockets[p.id];
    const privateState = room.game.getPlayerPrivateState(p.id);
    if (socketId && privateState) {
      io.to(socketId).emit('my_cards', privateState.hand);
    }
  });

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
          
          // Удаляем пользователя из менеджера если он не в других комнатах
          let isUserInOtherRooms = false;
          for (const [roomCode, roomData] of Object.entries(rooms)) {
            if (roomCode !== code && roomData.players.some(p => p.id === userId)) {
              isUserInOtherRooms = true;
              break;
            }
          }
          
          if (!isUserInOtherRooms) {
            userManager.removeUser(userId);
          }
        }
      }, 30000);
    }
  });

  /* ---------- USER NICKNAME ---------- */

  socket.on('set_nickname', ({ nickname, user }) => {
    try {
      const displayName = userManager.setNickname(user.id, nickname);
      
      // Обновляем имя во всех комнатах, где есть пользователь
      for (const [code, room] of Object.entries(rooms)) {
        const player = room.players.find(p => p.id === user.id);
        if (player) {
          player.name = displayName;
          
          // Если идет игра, обновляем и там
          if (room.game) {
            const gamePlayer = room.game.players.find(p => p.id === user.id);
            if (gamePlayer) {
              gamePlayer.name = displayName;
              io.to(code).emit('game_update', room.game.getPublicState());
            }
          }
          
          io.to(code).emit('room_update', room);
        }
      }
      
      socket.emit('nickname_set', { success: true, nickname: displayName });
      console.log(`📝 User ${user.id} set nickname: ${displayName}`);
      
    } catch (error) {
      socket.emit('nickname_set', { success: false, error: error.message });
    }
  });

  socket.on('get_nickname', ({ user }) => {
    const nickname = userManager.getNickname(user.id);
    socket.emit('nickname_info', { 
      nickname, 
      hasNickname: !!nickname 
    });
  });

  socket.on('generate_nickname', ({ user }) => {
    try {
      const randomNickname = userManager.generateRandomNickname(user.id);
      socket.emit('nickname_generated', { nickname: randomNickname });
    } catch (error) {
      socket.emit('nickname_generated', { error: error.message });
    }
  });

  /* ---------- ROOMS ---------- */

  socket.on('create_room', ({ user }) => {
    const code = generateRoomCode();
    userSockets[user.id] = socket.id;

    // Получаем имя через UserManager
    const displayName = getDisplayName(user, true);
    
    rooms[code] = {
      code,
      players: [{
        id: user.id,
        name: displayName,
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

    // Получаем имя через UserManager
    const displayName = getDisplayName(user, true);
    
    // Проверяем, есть ли уже игрок в комнате
    const existingPlayer = room.players.find(p => p.id === user.id);
    if (!existingPlayer) {
      room.players.push({
        id: user.id,
        name: displayName,
        chips: 1000
      });
    } else {
      // Если игрок уже есть, обновляем его сокет и имя
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

  /* ---------- GAME ---------- */

  socket.on('player_action', ({ code, playerId, action }) => {
    const room = rooms[code];
    if (!room || !room.game) return;

    try {
      room.game.playerAction(playerId, action);
      io.to(code).emit('game_update', room.game.getPublicState());

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
    
    // Удаляем пользователя из менеджера если он не в других комнатах
    setTimeout(() => {
      let isUserInOtherRooms = false;
      for (const [roomCode, roomData] of Object.entries(rooms)) {
        if (roomCode !== code && roomData.players.some(p => p.id === playerId)) {
          isUserInOtherRooms = true;
          break;
        }
      }
      
      if (!isUserInOtherRooms) {
        userManager.removeUser(playerId);
      }
    }, 10000);
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
      socket.emit('game_update', room.game.getPublicState());
      const privateState = room.game.getPlayerPrivateState(user.id);
      if (privateState) {
        socket.emit('my_cards', privateState.hand);
        socket.emit('my_private_state', privateState);
      }
    } else {
      socket.emit('room_joined', room);
    }
  });

  // Обработчик для проверки ника при входе
  socket.on('check_nickname_on_enter', ({ user }) => {
    const nickname = userManager.getNickname(user.id);
    const displayName = getDisplayName(user, false);
    
    socket.emit('nickname_check_result', { 
      hasNickname: !!nickname,
      displayName: displayName,
      nickname: nickname
    });
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👤 UserManager initialized`);
});