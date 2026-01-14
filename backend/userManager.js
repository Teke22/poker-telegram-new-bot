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
    
    for (const [userId, existingNickname] of this.userNicknames