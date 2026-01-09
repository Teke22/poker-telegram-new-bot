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

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

/* ---------------- FRONTEND ---------------- */
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

/* ---------------- SOCKET.IO ---------------- */
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

/* ---------------- ROOMS ---------------- */
const rooms = {};
const userSockets = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return !rooms[code] ? code : generateRoomCode();
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (!room) return;
  
  if (room.players.length === 0) {
    delete rooms[code];
    console.log(`🗑️ Room ${code} deleted (empty)`);
  }
}

// Функция для начала новой раздачи
function startNewHand(room) {
  try {
    if (!room) return false;
    
    console.log(`🔄 Starting new hand in room ${room.code}`);
    
    // Фильтруем игроков с фишками
    const playersWithChips = room.players.filter(p => p.chips > 0);
    
    if (playersWithChips.length < 2) {
      console.log(`💰 Not enough players with chips in ${room.code}`);
      room.game = null;
      io.to(room.code).emit('room_update', room);
      return false;
    }
    
    // Создаем новую игру с актуальными фишками
    const playersForGame = room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      isBot: p.isBot || false
    }));
    
    // Создаем новый GameState
    room.game = new GameState(playersForGame);
    
    // Запускаем игру
    const started = room.game.startGame();
    
    if (!started) {
      console.log(`❌ Failed to start game in ${room.code}`);
      room.game = null;
      io.to(room.code).emit('room_update', room);
      return false;
    }
    
    // Отправляем карты игрокам
    room.players.forEach(player => {
      const privateState = room.game.getPlayerPrivateState(player.id);
      if (privateState && player.chips > 0) {
        const playerSocketId = userSockets[player.id];
        if (playerSocketId) {
          io.to(playerSocketId).emit('my_cards', privateState.hand);
        }
      }
    });
    
    // Отправляем начальное состояние
    io.to(room.code).emit('game_started', {
      publicState: room.game.getPublicState()
    });
    
    console.log(`♻️ New hand started in ${room.code}, stage: ${room.game.stage}`);
    return true;
    
  } catch (error) {
    console.error('Error starting new hand:', error);
    return false;
  }
}

io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    let disconnectedUserId = null;
    for (const [userId, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        delete userSockets[userId];
        break;
      }
    }
    
    if (disconnectedUserId) {
      for (const [code, room] of Object.entries(rooms)) {
        const player = room.players.find(p => p.id === disconnectedUserId);
        if (player) {
          console.log(`⚠️ Player ${player.name} disconnected from ${code}`);
          
          if (room.game && room.game.stage !== 'waiting') {
            try {
              room.game.playerLeave(disconnectedUserId);
              io.to(code).emit('game_update', room.game.getPublicState());
            } catch (error) {
              console.error('Error handling disconnect:', error);
            }
          }
          
          setTimeout(() => {
            if (rooms[code] && !userSockets[disconnectedUserId]) {
              rooms[code].players = rooms[code].players.filter(p => p.id !== disconnectedUserId);
              if (rooms[code].players.length === 0) {
                delete rooms[code];
              } else {
                io.to(code).emit('room_update', rooms[code]);
              }
            }
          }, 30000);
        }
      }
    }
  });

  socket.on('create_room', ({ user }) => {
    try {
      const code = generateRoomCode();
      
      userSockets[user.id] = socket.id;
      
      rooms[code] = {
        code,
        players: [{ 
          id: user.id, 
          name: user.first_name || user.name || 'Player', 
          chips: 1000,
          isBot: false
        }],
        game: null,
        createdAt: new Date()
      };
      
      socket.join(code);
      socket.emit('room_joined', rooms[code]);
      io.to(code).emit('room_update', rooms[code]);
      
      console.log(`🏠 Room ${code} created by ${user.first_name}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error_msg', 'Ошибка создания комнаты');
    }
  });

  socket.on('join_room', ({ code, user }) => {
    try {
      const room = rooms[code];
      if (!room) {
        socket.emit('error_msg', 'Комната не найдена');
        return;
      }
      
      if (room.game && room.game.stage !== 'waiting') {
        socket.emit('error_msg', 'Игра уже началась');
        return;
      }
      
      if (room.players.find(p => p.id === user.id)) {
        socket.emit('room_joined', room);
        return;
      }
      
      if (room.players.length >= 8) {
        socket.emit('error_msg', 'Комната заполнена (максимум 8 игроков)');
        return;
      }
      
      userSockets[user.id] = socket.id;
      
      room.players.push({
        id: user.id,
        name: user.first_name || user.name || 'Player',
        chips: 1000,
        isBot: false
      });
      
      socket.join(code);
      socket.emit('room_joined', room);
      io.to(code).emit('room_update', room);
      
      console.log(`👤 ${user.first_name} joined ${code}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error_msg', 'Ошибка входа в комнату');
    }
  });

  socket.on('start_game', ({ code }) => {
    try {
      const room = rooms[code];
      if (!room || room.players.length < 2) {
        socket.emit('error_msg', 'Недостаточно игроков');
        return;
      }
      
      if (room.game && room.game.stage !== 'waiting') {
        socket.emit('error_msg', 'Игра уже началась');
        return;
      }
      
      const playersForGame = room.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        isBot: p.isBot || false
      }));
      
      room.game = new GameState(playersForGame);
      const started = room.game.startGame();
      
      if (!started) {
        socket.emit('error_msg', 'Не удалось начать игру');
        return;
      }
      
      // Отправляем карты
      room.players.forEach(player => {
        const privateState = room.game.getPlayerPrivateState(player.id);
        if (privateState && player.chips > 0) {
          const playerSocketId = userSockets[player.id];
          if (playerSocketId) {
            io.to(playerSocketId).emit('my_cards', privateState.hand);
          }
        }
      });
      
      io.to(code).emit('game_started', {
        publicState: room.game.getPublicState()
      });
      
      console.log(`🎮 Game started in ${code} with ${room.players.length} players`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error_msg', 'Ошибка запуска игры: ' + error.message);
    }
  });

  socket.on('player_action', ({ code, playerId, action }) => {
    try {
      const room = rooms[code];
      if (!room || !room.game) {
        socket.emit('error_msg', 'Игра не найдена');
        return;
      }
      
      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('error_msg', 'Игрок не найден');
        return;
      }
      
      console.log(`🎯 ${player.name} action:`, action);
      
      // Обрабатываем действие
      room.game.playerAction(playerId, action);
      
      // Отправляем обновленное состояние
      const publicState = room.game.getPublicState();
      io.to(code).emit('game_update', publicState);
      
      // Если игра завершена
      if (room.game.finished) {
        // Обновляем фишки игроков
        room.players.forEach(roomPlayer => {
          const gamePlayer = room.game.players.find(p => p.id === roomPlayer.id);
          if (gamePlayer) {
            roomPlayer.chips = gamePlayer.chips;
          }
        });
        
        // Отправляем событие завершения
        io.to(code).emit('hand_finished', {
          winners: publicState.winners,
          reason: room.game.players.filter(p => !p.folded).length === 1 ? 'fold' : 'showdown'
        });
        
        // Автоперезапуск через 3 секунды
        setTimeout(() => {
          if (rooms[code]) {
            startNewHand(room);
          }
        }, config.NEXT_HAND_DELAY);
      }
      
    } catch (error) {
      console.error('Error processing action:', error);
      socket.emit('error_msg', error.message || 'Ошибка выполнения действия');
    }
  });

  socket.on('get_my_cards', ({ code, playerId }) => {
    try {
      const room = rooms[code];
      if (!room || !room.game) {
        socket.emit('error_msg', 'Игра не найдена');
        return;
      }
      
      const privateState = room.game.getPlayerPrivateState(playerId);
      if (privateState) {
        socket.emit('my_cards', privateState.hand);
      }
    } catch (error) {
      console.error('Error getting cards:', error);
      socket.emit('error_msg', 'Ошибка получения карт');
    }
  });

  socket.on('leave_room', ({ code, playerId }) => {
    const room = rooms[code];
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);
      
      if (room.game && room.game.stage !== 'waiting') {
        try {
          room.game.playerLeave(playerId);
          io.to(code).emit('game_update', room.game.getPublicState());
        } catch (error) {
          console.error('Error handling leave:', error);
        }
      }
      
      io.to(code).emit('room_update', room);
      cleanupRoom(code);
      console.log(`👋 Player ${playerId} left ${code}`);
    }
  });
});

/* ---------------- START ---------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📁 Serving from: ${frontendPath}`);
});