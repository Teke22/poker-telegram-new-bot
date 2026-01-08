require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { GameState } = require('./game/gameState');

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
const userSockets = {}; // Для отслеживания пользователей

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключаем похожие символы
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Проверяем уникальность
  if (!rooms[code]) {
    return code;
  }
  return generateRoomCode(); // Рекурсия если код занят
}

function cleanupRoom(code) {
  const room = rooms[code];
  if (!room) return;
  
  // Удаляем комнату если пустая
  if (room.players.length === 0) {
    delete rooms[code];
    console.log(`🗑️ Room ${code} deleted (empty)`);
  }
}

io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Удаляем пользователя из userSockets
    for (const [userId, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) {
        delete userSockets[userId];
        break;
      }
    }
    
    // Проверяем все комнаты на наличие отключенных пользователей
    for (const [code, room] of Object.entries(rooms)) {
      const disconnectedPlayer = room.players.find(p => 
        userSockets[p.id] === undefined && p.id !== 'debug'
      );
      
      if (disconnectedPlayer) {
        console.log(`⚠️ Player ${disconnectedPlayer.name} disconnected from ${code}`);
        
        // Уведомляем остальных игроков
        io.to(code).emit('room_update', room);
      }
    }
  });

  socket.on('create_room', ({ user }) => {
    try {
      const code = generateRoomCode();
      
      // Сохраняем связь пользователь-сокет
      userSockets[user.id] = socket.id;
      
      rooms[code] = {
        code,
        players: [{ 
          id: user.id, 
          name: user.first_name || user.name || 'Player', 
          chips: 1000 
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
      
      // Проверяем, не находится ли пользователь уже в комнате
      if (room.players.find(p => p.id === user.id)) {
        socket.emit('room_joined', room);
        return;
      }
      
      if (room.players.length >= 8) {
        socket.emit('error_msg', 'Комната заполнена (максимум 8 игроков)');
        return;
      }
      
      // Сохраняем связь пользователь-сокет
      userSockets[user.id] = socket.id;
      
      room.players.push({
        id: user.id,
        name: user.first_name || user.name || 'Player',
        chips: 1000
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

  socket.on('reconnect_room', ({ code, user }) => {
    const room = rooms[code];
    if (!room) {
      socket.emit('error_msg', 'Комната больше не существует');
      return;
    }
    
    // Проверяем, есть ли пользователь в комнате
    const player = room.players.find(p => p.id === user.id);
    if (!player) {
      socket.emit('error_msg', 'Вы не в этой комнате');
      return;
    }
    
    // Обновляем связь сокета
    userSockets[user.id] = socket.id;
    socket.join(code);
    
    if (room.game) {
      // Если игра идет, отправляем текущее состояние
      socket.emit('game_update', room.game.getPublicState());
      
      // Отправляем карты игрока
      const privateState = room.game.getPlayerPrivateState(user.id);
      if (privateState) {
        socket.emit('my_cards', privateState.hand);
      }
    } else {
      socket.emit('room_joined', room);
    }
    
    console.log(`🔁 ${user.first_name} reconnected to ${code}`);
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
      
      room.game = new GameState(room.players);
      room.game.startGame();
      
      // Отправляем карты каждому игроку
      room.players.forEach(player => {
        const privateState = room.game.getPlayerPrivateState(player.id);
        if (privateState) {
          io.to(code).emit('my_cards', privateState.hand);
        }
      });
      
      io.to(code).emit('game_started', {
        publicState: room.game.getPublicState()
      });
      
      console.log(`🎮 Game started in ${code} with ${room.players.length} players`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error_msg', 'Ошибка запуска игры');
    }
  });

  socket.on('player_action', ({ code, playerId, action }) => {
    try {
      const room = rooms[code];
      if (!room || !room.game) {
        socket.emit('error_msg', 'Игра не найдена');
        return;
      }
      
      // Проверяем, что игрок существует
      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('error_msg', 'Игрок не найден');
        return;
      }
      
      console.log(`🎯 ${player.name} action:`, action);
      
      // Выполняем действие
      room.game.playerAction(playerId, action);
      
      // Отправляем обновленное состояние всем
      io.to(code).emit('game_update', room.game.getPublicState());
      
      // Если игра завершена
      if (room.game.finished) {
        const winner = room.game.getWinner();
        
        io.to(code).emit('hand_finished', {
          winner: winner ? { id: winner.id, name: winner.name } : null,
          reason: 'showdown'
        });
        
        // Через 5 секунд начинаем новую раздачу
        setTimeout(() => {
          try {
            // Проверяем, что игра еще существует и есть хотя бы 2 игрока с фишками
            if (room && room.game) {
              const activePlayers = room.game.players.filter(p => p.chips > 0);
              
              if (activePlayers.length >= 2) {
                room.game.startGame();
                
                // Отправляем карты каждому игроку
                room.players.forEach(player => {
                  const privateState = room.game.getPlayerPrivateState(player.id);
                  if (privateState) {
                    io.to(code).emit('my_cards', privateState.hand);
                  }
                });
                
                io.to(code).emit('game_started', {
                  publicState: room.game.getPublicState()
                });
                
                console.log(`♻️ New hand started in ${code}`);
              } else {
                console.log(`💰 Not enough players with chips in ${code}`);
                room.game = null;
                io.to(code).emit('room_update', room);
              }
            }
          } catch (error) {
            console.error('Error starting new hand:', error);
          }
        }, 5000);
      }
      
      // После действия, если это был ход текущего игрока, отправляем ему карты
      if (room.game.currentPlayer?.id === playerId) {
        const privateState = room.game.getPlayerPrivateState(playerId);
        if (privateState) {
          socket.emit('my_cards', privateState.hand);
        }
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
      } else {
        socket.emit('error_msg', 'Карты не найдены');
      }
    } catch (error) {
      console.error('Error getting cards:', error);
      socket.emit('error_msg', 'Ошибка получения карт');
    }
  });

  socket.on('get_room_state', ({ code }) => {
    const room = rooms[code];
    if (room) {
      socket.emit('room_state', room);
    }
  });

  socket.on('leave_room', ({ code, playerId }) => {
    const room = rooms[code];
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);
      
      // Если игра идет, фолдим игрока
      if (room.game) {
        const playerInGame = room.game.players.find(p => p.id === playerId);
        if (playerInGame) {
          playerInGame.folded = true;
          room.game.checkHandCompletion();
        }
      }
      
      io.to(code).emit('room_update', room);
      cleanupRoom(code);
      
      console.log(`👋 Player ${playerId} left ${code}`);
    }
  });
});

/* ---------------- CLEANUP ---------------- */

// Очистка неактивных комнат каждые 10 минут
setInterval(() => {
  const now = new Date();
  for (const [code, room] of Object.entries(rooms)) {
    const age = now - room.createdAt;
    const hours = age / (1000 * 60 * 60);
    
    // Удаляем комнаты старше 24 часов или пустые
    if (hours > 24 || room.players.length === 0) {
      delete rooms[code];
      console.log(`🧹 Cleaned up room ${code}`);
    }
  }
}, 10 * 60 * 1000);

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📁 Serving from: ${frontendPath}`);
});