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
const userSockets = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  if (!rooms[code]) {
    return code;
  }
  return generateRoomCode();
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
    if (!room || !room.game) return false;
    
    console.log(`🔄 Starting new hand in room ${room.code}`);
    
    // Фильтруем игроков с фишками
    const playersWithChips = room.players.filter(p => p.chips > 0);
    
    if (playersWithChips.length < 2) {
      console.log(`💰 Not enough players with chips in ${room.code}`);
      room.game = null;
      io.to(room.code).emit('room_update', room);
      return false;
    }
    
    // Обновляем фишки игроков в состоянии игры
    room.game.players.forEach(gamePlayer => {
      const roomPlayer = room.players.find(p => p.id === gamePlayer.id);
      if (roomPlayer) {
        gamePlayer.chips = roomPlayer.chips;
      }
    });
    
    // Запускаем новую раздачу
    room.game.startGame();
    
    if (room.game.stage === 'waiting') {
      // Игра не запустилась
      room.game = null;
      io.to(room.code).emit('room_update', room);
      return false;
    }
    
    // Отправляем карты каждому игроку
    room.players.forEach(player => {
      const privateState = room.game.getPlayerPrivateState(player.id);
      if (privateState && player.chips > 0) {
        const playerSocketId = userSockets[player.id];
        if (playerSocketId) {
          io.to(playerSocketId).emit('my_cards', privateState.hand);
        }
      }
    });
    
    // Отправляем начальное состояние игры
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
              
              if (room.game.finished) {
                const winner = room.game.getWinner();
                
                // ✅ ЗДЕСЬ ДОБАВЛЯЕМ АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК
                setTimeout(() => {
                  io.to(code).emit('hand_finished', {
                    winner: winner ? { id: winner.id, name: winner.name } : null,
                    reason: 'disconnect'
                  });
                  
                  // ⏰ Автоматический запуск новой раздачи через 3 секунды
                  setTimeout(() => {
                    if (rooms[code]) { // Проверяем что комната еще существует
                      startNewHand(rooms[code]);
                    }
                  }, config.NEXT_HAND_DELAY || 3000);
                  
                }, 1000);
              }
            } catch (error) {
              console.error('Error handling disconnect in game:', error);
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
    
    const player = room.players.find(p => p.id === user.id);
    if (!player) {
      socket.emit('error_msg', 'Вы не в этой комнате');
      return;
    }
    
    userSockets[user.id] = socket.id;
    socket.join(code);
    
    if (room.game) {
      socket.emit('game_update', room.game.getPublicState());
      
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
      
      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('error_msg', 'Игрок не найден');
        return;
      }
      
      console.log(`🎯 ${player.name} action:`, action);
      
      room.game.playerAction(playerId, action);
      
      io.to(code).emit('game_update', room.game.getPublicState());
      
      // ✅ ОБРАБОТКА ЗАВЕРШЕНИЯ РАЗДАЧИ С АВТОПЕРЕЗАПУСКОМ
      if (room.game.finished) {
        const winner = room.game.getWinner();
        
        io.to(code).emit('hand_finished', {
          winner: winner ? { id: winner.id, name: winner.name } : null,
          reason: room.game.players.filter(p => !p.folded).length === 1 ? 'fold' : 'showdown'
        });
        
        // Обновляем фишки игроков в комнате
        room.players.forEach(roomPlayer => {
          const gamePlayer = room.game.players.find(p => p.id === roomPlayer.id);
          if (gamePlayer) {
            roomPlayer.chips = gamePlayer.chips;
          }
        });
        
        // ✅ ЗДЕСЬ ГЛАВНОЕ: АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК ЧЕРЕЗ 3 СЕКУНДЫ
        setTimeout(() => {
          if (rooms[code]) { // Проверяем что комната все еще существует
            startNewHand(room);
          }
        }, config.NEXT_HAND_DELAY || 3000);
      }
      
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
      
      if (room.game && room.game.stage !== 'waiting') {
        try {
          room.game.playerLeave(playerId);
          
          io.to(code).emit('game_update', room.game.getPublicState());
          
          if (room.game.finished) {
            const winner = room.game.getWinner();
            
            setTimeout(() => {
              io.to(code).emit('hand_finished', {
                winner: winner ? { id: winner.id, name: winner.name } : null,
                reason: 'player_left'
              });
              
              room.players.forEach(roomPlayer => {
                const gamePlayer = room.game.players.find(p => p.id === roomPlayer.id);
                if (gamePlayer) {
                  roomPlayer.chips = gamePlayer.chips;
                }
              });
              
              // ✅ АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК И ДЛЯ ВЫШЕДШИХ ИГРОКОВ
              setTimeout(() => {
                if (rooms[code] && rooms[code].players.length >= 2) {
                  startNewHand(rooms[code]);
                }
              }, config.NEXT_HAND_DELAY || 3000);
              
            }, 1000);
          }
        } catch (error) {
          console.error('Error handling leave in game:', error);
        }
      }
      
      io.to(code).emit('room_update', room);
      cleanupRoom(code);
      
      console.log(`👋 Player ${playerId} left ${code}`);
    }
  });

  socket.on('player_leave', ({ code, playerId }) => {
    try {
      const room = rooms[code];
      if (!room) {
        socket.emit('error_msg', 'Комната не найдена');
        return;
      }
      
      room.players = room.players.filter(p => p.id !== playerId);
      
      if (room.game && room.game.stage !== 'waiting') {
        try {
          room.game.playerLeave(playerId);
          
          io.to(code).emit('game_update', room.game.getPublicState());
          
          if (room.game.finished) {
            const winner = room.game.getWinner();
            
            setTimeout(() => {
              io.to(code).emit('hand_finished', {
                winner: winner ? { id: winner.id, name: winner.name } : null,
                reason: 'player_left'
              });
              
              room.players.forEach(roomPlayer => {
                const gamePlayer = room.game.players.find(p => p.id === roomPlayer.id);
                if (gamePlayer) {
                  roomPlayer.chips = gamePlayer.chips;
                }
              });
              
              // ✅ АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК
              setTimeout(() => {
                if (rooms[code] && rooms[code].players.length >= 2) {
                  startNewHand(rooms[code]);
                }
              }, config.NEXT_HAND_DELAY || 3000);
              
            }, 1000);
          }
        } catch (error) {
          console.error('Error handling player leave in game:', error);
        }
      }
      
      io.to(code).emit('room_update', room);
      
      if (room.players.length === 0) {
        delete rooms[code];
        console.log(`🗑️ Room ${code} deleted (empty)`);
      } else {
        console.log(`👋 Player ${playerId} left ${code}. Players left: ${room.players.length}`);
      }
      
    } catch (error) {
      console.error('Error processing leave:', error);
      socket.emit('error_msg', 'Ошибка при выходе из игры');
    }
  });
});

/* ---------------- CLEANUP ---------------- */

setInterval(() => {
  const now = new Date();
  for (const [code, room] of Object.entries(rooms)) {
    const age = now - room.createdAt;
    const hours = age / (1000 * 60 * 60);
    
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