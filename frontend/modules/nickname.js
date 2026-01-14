import { me, hasNickname, updateStatus } from './utils.js';
import { socket } from './socket.js';
import { showLobby } from './lobby.js';

export function showNicknameDialog(forceShow = false) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="nickname-dialog">
            <div class="nickname-content">
                <!-- Содержимое диалога ника -->
                ${renderNicknameDialogContent(forceShow)}
            </div>
        </div>
    `;
    
    setTimeout(() => {
        const input = document.getElementById('nicknameInput');
        if (input) {
            input.focus();
            if (me.name && !forceShow) {
                input.value = me.name;
            }
        }
    }, 100);
    
    updateStatus('Выберите никнейм для игры');
}

function renderNicknameDialogContent(forceShow) {
    return `
        <h2 class="nickname-title">🎮 ВЫБЕРИТЕ НИКНЕЙМ</h2>
        <p class="nickname-subtitle">Ваше имя будет отображаться у всех игроков за столом</p>
        
        ${!forceShow && me.name ? `
            <div class="current-nickname">
                <p>Текущий ник: <span>${me.name}</span></p>
                <p style="font-size:14px; color:#bdc3c7; margin-top:5px;">
                    Вы можете оставить текущий или выбрать новый
                </p>
            </div>
        ` : ''}
        
        <div style="margin-bottom:20px;">
            <input id="nicknameInput" class="nickname-input" 
                   placeholder="Введите ник (3-15 символов)" 
                   maxlength="15">
            <div id="nicknameError" class="nickname-error"></div>
        </div>
        
        <div class="nickname-buttons">
            <button onclick="window.setNickname()" class="nickname-btn nickname-btn-save">
                ✅ ${me.name ? 'СОХРАНИТЬ НОВЫЙ НИК' : 'СОХРАНИТЬ НИК'}
            </button>
            
            <button onclick="window.generateRandomNickname()" class="nickname-btn nickname-btn-random">
                🎲 СЛУЧАЙНЫЙ НИК
            </button>
            
            ${!forceShow && me.name ? `
                <button onclick="window.skipNickname()" class="nickname-btn nickname-btn-skip">
                    ⏩ ПРОДОЛЖИТЬ С ТЕКУЩИМ
                </button>
            ` : ''}
            
            ${forceShow ? `
                <button onclick="window.forceSkipNickname()" class="nickname-btn nickname-btn-skip">
                    ⚡ ИСПОЛЬЗОВАТЬ ИМЯ ИЗ TELEGRAM
                </button>
            ` : ''}
        </div>
        
        <div class="nickname-rules">
            <p>Можно использовать буквы (русские/английские), цифры и символ _</p>
            <p style="margin-top:5px;">Пример: Poker_King, Игрок_123, Cool_Guy</p>
        </div>
    `;
}

export function setNickname() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const errorEl = document.getElementById('nicknameError');
    
    if (!nickname) {
        errorEl.textContent = 'Введите никнейм';
        return;
    }
    
    if (nickname.length < 3) {
        errorEl.textContent = 'Никнейм должен быть не менее 3 символов';
        return;
    }
    
    if (nickname.length > 15) {
        errorEl.textContent = 'Никнейм должен быть не более 15 символов';
        return;
    }
    
    socket.emit('set_nickname', { nickname, user: me });
}

export function generateRandomNickname() {
    socket.emit('generate_nickname', { user: me });
}

export function skipNickname() {
    showLobby();
}

export function forceSkipNickname() {
    me.name = getTelegramFallbackName();
    hasNickname = false;
    showLobby();
}

// Экспортируем функции в глобальную область видимости
window.setNickname = setNickname;
window.generateRandomNickname = generateRandomNickname;
window.skipNickname = skipNickname;
window.forceSkipNickname = forceSkipNickname;