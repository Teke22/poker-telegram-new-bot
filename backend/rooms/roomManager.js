class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room
  }

  createRoom(owner) {
    const code = this.generateCode();

    const room = {
      code,
      ownerId: owner.id,
      players: [
        {
          id: owner.id,
          name: this._getPlayerDisplayName(owner),
          chips: 1000, // Добавляем начальные фишки
        },
      ],
      state: 'lobby', // lobby | playing
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
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Комната заполнена');
    }

    room.players.push({
      id: user.id,
      name: this._getPlayerDisplayName(user),
      chips: 1000, // Начальные фишки
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
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  // Новый метод для формирования имени игрока
  _getPlayerDisplayName(user) {
    // Если есть username в Telegram, используем его
    if (user.username) {
      return `@${user.username}`;
    }
    
    // Если есть first_name и last_name
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    
    // Если только first_name
    if (user.first_name) {
      // Добавляем короткую версию ID для уникальности
      const shortId = String(user.id).slice(-4);
      return `${user.first_name}_${shortId}`;
    }
    
    // Если ничего нет, генерируем имя
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `Player_${randomId}`;
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