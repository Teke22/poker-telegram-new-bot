const UserManager = require('./userManager');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room
    this.userManager = new UserManager();
  }

  createRoom(owner) {
    const code = this.generateCode();

    // Получаем отображаемое имя через UserManager
    const displayName = this.userManager.getDisplayName(owner, true);

    const room = {
      code,
      ownerId: owner.id,
      players: [
        {
          id: owner.id,
          name: displayName,
          chips: 1000,
        },
      ],
      state: 'lobby',
      smallBlind: 10,
      bigBlind: 20,
      minBuyin: 100,
      maxPlayers: 6,
    };

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, user) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Комната не найдена');

    // Если игрок уже в комнате, возвращаем его
    const existingPlayer = room.players.find(p => p.id === user.id);
    if (existingPlayer) {
      // Обновляем имя на случай если изменился ник
      existingPlayer.name = this.userManager.getDisplayName(user, true);
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Комната заполнена');
    }

    // Получаем отображаемое имя через UserManager
    const displayName = this.userManager.getDisplayName(user, true);

    room.players.push({
      id: user.id,
      name: displayName,
      chips: 1000,
    });

    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  removeUserFromRooms(userId) {
    for (const [code, room] of this.rooms.entries()) {
      room.players = room.players.filter(p => p.id !== userId);

      if (room.players.length === 0) {
        this.rooms.delete(code);
      }
    }
    
    // Удаляем пользователя из UserManager если он не в других комнатах
    let isUserInAnyRoom = false;
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === userId)) {
        isUserInAnyRoom = true;
        break;
      }
    }
    
    if (!isUserInAnyRoom) {
      this.userManager.removeUser(userId);
    }
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  // Получить UserManager для использования в других частях приложения
  getUserManager() {
    return this.userManager;
  }

  // Обновить имя игрока во всех комнатах
  updatePlayerName(userId, newName) {
    for (const [code, room] of this.rooms.entries()) {
      const player = room.players.find(p => p.id === userId);
      if (player) {
        player.name = newName;
      }
    }
  }

  // Дополнительные методы для управления комнатой
  updatePlayerChips(code, playerId, chips) {
    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.chips = chips;
      return true;
    }
    return false;
  }

  getPlayerCount(code) {
    const room = this.rooms.get(code);
    return room ? room.players.length : 0;
  }

  isRoomPlaying(code) {
    const room = this.rooms.get(code);
    return room ? room.state === 'playing' : false;
  }

  setRoomState(code, state) {
    const room = this.rooms.get(code);
    if (room) {
      room.state = state;
      return true;
    }
    return false;
  }

  // Получить список комнат для лобби
  getAvailableRooms() {
    const availableRooms = [];
    for (const [code, room] of this.rooms.entries()) {
      if (room.state === 'lobby' && room.players.length < room.maxPlayers) {
        availableRooms.push({
          code: room.code,
          players: room.players.length,
          maxPlayers: room.maxPlayers,
        });
      }
    }
    return availableRooms;
  }
}

module.exports = RoomManager;