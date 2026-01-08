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
          name: owner.first_name,
        },
      ],
      state: 'lobby', // lobby | playing
    };

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, user) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Комната не найдена');

    if (room.players.find(p => p.id === user.id)) {
      return room;
    }

    if (room.players.length >= 6) {
      throw new Error('Комната заполнена');
    }

    room.players.push({
      id: user.id,
      name: user.first_name,
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
}

module.exports = RoomManager;
