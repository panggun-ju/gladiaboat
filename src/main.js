// src/main.js
import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { Progression } from './progression.js';

class UIManager {
    constructor() {
        this.levelText = document.getElementById('level-text');
        this.xpText = document.getElementById('xp-text');
        this.levelUpScreen = document.getElementById('level-up-screen');
        this.cardsContainer = document.getElementById('cards-container');
        
        this.isPaused = false;
    }

    updateHUD(level, xp, xpToNext) {
        this.levelText.innerText = level;
        this.xpText.innerText = `${xp}/${xpToNext}`;
    }

    showLevelUpMenu(choices, onSelect) {
        this.isPaused = true;
        this.levelUpScreen.classList.remove('hidden');
        this.cardsContainer.innerHTML = '';

        choices.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
            `;
            card.addEventListener('click', () => {
                onSelect(item);
                this.levelUpScreen.classList.add('hidden');
                this.isPaused = false;
            });
            this.cardsContainer.appendChild(card);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('game-container');
    const gameCanvas = document.getElementById('game-canvas');
    const uiCanvas = document.getElementById('ui-canvas');

    const uiManager = new UIManager();
    const inputManager = new InputManager(container);
    const renderer = new Renderer(gameCanvas, uiCanvas);
    
    const progression = new Progression(uiManager);
    const game = new Game(540, 960, progression);

    // 카메라 흔들림 연동
    game.onShake = (magnitude, duration) => {
        renderer.triggerShake(magnitude, duration);
    };

    let lastTime = performance.now();

    function loop(currentTime) {
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // 레벨업 시 게임 일시정지 (렌더링만 유지)
        if (!uiManager.isPaused) {
            game.update(dt, inputManager);
            uiManager.updateHUD(progression.level, progression.xp, progression.xpToNextLevel);
        }

        renderer.clear();
        renderer.drawGame(game);
        
        // 일시정지 중이 아닐 때만 UI(마우스 오라) 그림
        if (!uiManager.isPaused) {
            renderer.drawUI(inputManager);
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
});