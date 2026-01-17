class UserManager {
  constructor() {
    this.userNicknames = new Map();
    this.pendingNicknames = new Map();
  }

  getNickname(userId) {
    return this.userNicknames.get(userId);
  }

  setNickname(userId, nickname) {
    if (!this.isValidNickname(nickname)) {
      throw new Error('Некорректный никнейм. Используйте 3-15 символов (буквы, цифры, _)');
    }
    
    if (this.isNicknameTaken(nickname, userId)) {
      throw new Error('Этот никнейм уже занят');
    }
    
    this.userNicknames.set(userId, nickname.trim());
    return nickname;
  }

  isValidNickname(nickname) {
    if (!nickname || typeof nickname !== 'string') return false;
    
    const trimmed = nickname.trim();
    if (trimmed.length < 3 || trimmed.length > 15) return false;
    
    const regex = /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/;
    return regex.test(trimmed);
  }

  isNicknameTaken(nickname, excludeUserId = null) {
    const targetNickname = nickname.trim().toLowerCase();
    
    for (const [userId, existingNickname] of this.userNicknames.entries()) {
      if (userId !== excludeUserId && existingNickname.toLowerCase() === targetNickname) {
        return true;
      }
    }
    return false;
  }

  generateRandomNickname(userId) {
    const adjectives = ['Храбрый', 'Ловкий', 'Мудрый', 'Быстрый', 'Сильный', 'Удачливый', 'Хитрый', 'Смелый', 'Отважный', 'Смелый'];
    const nouns = ['Тигр', 'Волк', 'Орел', 'Дракон', 'Рыцарь', 'Маг', 'Стрелок', 'Воин', 'Игрок', 'Покер'];
    const randomNum = Math.floor(Math.random() * 999) + 1;
    
    const randomNickname = `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}${randomNum}`;
    
    if (this.isNicknameTaken(randomNickname)) {
      return this.generateRandomNickname(userId);
    }
    
    this.setNickname(userId, randomNickname);
    return randomNickname;
  }

  removeUser(userId) {
    this.userNicknames.delete(userId);
    this.pendingNicknames.delete(userId);
  }

  getDisplayName(user, useFallback = true) {
    const nickname = this.getNickname(user.id);
    if (nickname) {
      return nickname;
    }
    
    if (user.username) {
      return `@${user.username}`;
    }
    
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    
    if (user.first_name) {
      const shortId = String(user.id).slice(-4);
      return `${user.first_name}_${shortId}`;
    }
    
    if (useFallback) {
      return this.generateRandomNickname(user.id);
    }
    
    return `Player_${String(user.id).slice(-6)}`;
  }

  setPendingNickname(userId, data) {
    this.pendingNicknames.set(userId, data);
  }

  getPendingNickname(userId) {
    return this.pendingNicknames.get(userId);
  }

  clearPendingNickname(userId) {
    this.pendingNicknames.delete(userId);
  }

  getStats() {
    return {
      totalUsers: this.userNicknames.size,
      nicknamesSet: Array.from(this.userNicknames.values())
    };
  }
}

module.exports = UserManager;