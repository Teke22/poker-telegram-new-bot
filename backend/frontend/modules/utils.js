// Глобальные переменные
export let me = null;
export let room = null;
export let gameState = null;
export let myCards = [];
export let winnersShown = false;
export let showWinnersTimeout = null;
export let hasNickname = false;

// Инициализируем пользователя
export function initUser() {
    const tg = window.Telegram?.WebApp;
    
    if (tg && tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        me = {
            id: String(user.id),
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            name: '',
            chips: 1000
        };
    } else {
        const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        me = {
            id: 'debug_' + randomId,
            username: null,
            first_name: null,
            last_name: null,
            name: '',
            chips: 1000
        };
    }
}

// Функции утилиты
export function getPlayerDisplayName(player, isMe = false) {
    if (isMe) return `${player.name} 👤`;
    
    if (!player.name) return `Игрок...`;
    
    if (player.name.startsWith('@')) return player.name;
    
    return player.name.length > 15 ? player.name.substring(0, 15) + '...' : player.name;
}

export function renderCard(card, isWinning = false) {
    if (!card) return '';
    
    const rank = card.rank;
    const suit = card.suit.toLowerCase();
    const isRed = suit === 'h' || suit === 'd';
    const suitSymbol = {
        's': '♠',
        'h': '♥',
        'd': '♦',
        'c': '♣'
    }[suit] || suit;
    
    let rankSymbol = rank;
    if (rank === 'J') rankSymbol = 'В';
    else if (rank === 'Q') rankSymbol = 'Д';
    else if (rank === 'K') rankSymbol = 'К';
    else if (rank === 'A') rankSymbol = 'Т';
    else if (rank === 'T') rankSymbol = '10';
    
    return `
        <div class="card ${isRed ? 'card-red' : 'card-black'} ${isWinning ? 'winning-card' : ''}">
            <div class="card-rank">${rankSymbol}</div>
            <div class="card-center">${suitSymbol}</div>
            <div class="card-suit">${suitSymbol}</div>
        </div>
    `;
}

export function getStageName(stage) {
    const stages = {
        'preflop': 'Префлоп',
        'flop': 'Флоп',
        'turn': 'Тёрн',
        'river': 'Ривер',
        'showdown': 'Шоудаун'
    };
    return stages[stage] || stage;
}

export function updateStatus(text) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerText = text;
    }
}

export function getTelegramFallbackName() {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        if (user.username) return `@${user.username}`;
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        if (user.first_name) return user.first_name;
    }
    return `Игрок_${String(me.id).slice(-4)}`;
}