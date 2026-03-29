import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { Progression } from './progression.js';
import { AudioSys } from './audio.js';

class UIManager {
    constructor() {
        this.levelText = document.getElementById('level-text');
        this.xpText = document.getElementById('xp-text');
        this.xpBarFill = document.getElementById('xp-bar-fill');
        this.hpText = document.getElementById('hp-text');
        this.hpBarFill = document.getElementById('hp-bar-fill');
        this.stateText = document.getElementById('state-text');
        this.enemyCount = document.getElementById('enemy-count');
        this.enemyMax = document.getElementById('enemy-max');
        this.levelUpScreen = document.getElementById('level-up-screen');
        this.cardsContainer = document.getElementById('cards-container');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.restartBtn = document.getElementById('restart-btn');
        
        this.howToPlayScreen = document.getElementById('how-to-play-screen');
        this.startGameBtn = document.getElementById('start-game-btn');
        
        // 튜토리얼 때문에 최초 상태는 Paused
        this.isPaused = true;
        this.isGameOver = false;

        if (this.startGameBtn) {
            this.startGameBtn.addEventListener('click', () => {
                if(this.howToPlayScreen) this.howToPlayScreen.classList.add('hidden');
                this.isPaused = false; // 게임 시작!
                
                // AudioSys 강제 켜기 (브라우저 정책상 사용자 상호작용 후이므로 가능)
                const audioToggleBtn = document.getElementById('audio-toggle');
                if (AudioSys && !AudioSys.enabled && audioToggleBtn) {
                    AudioSys.toggle();
                    audioToggleBtn.innerText = '🔊';
                }

                // 게임이 시작되었으므로 기본 커서를 숨깁니다 (style.css 에 정의된 클래스 추가)
                document.body.classList.add('game-active');
            });
        }
    }

    updateHUD(level, xp, xpToNext, state, enemies, maxEnemies, hp, maxHp) {
        this.levelText.innerText = level;
        this.xpText.innerText = `${Math.floor(xp)}/${xpToNext}`;
        
        const xpRatio = Math.min(100, Math.max(0, (xp / xpToNext) * 100));
        this.xpBarFill.style.width = `${xpRatio}%`;
        
        this.hpText.innerText = `${Math.floor(hp)}/${maxHp}`;
        const hpRatio = Math.min(100, Math.max(0, (hp / maxHp) * 100));
        this.hpBarFill.style.width = `${hpRatio}%`;
        
        let stateStr = '대기';
        if (state === 'rowing') stateStr = '노 젓기';
        else if (state === 'slashing') stateStr = '공격 준비';
        else if (state === 'blocking') stateStr = '방어';
        
        this.stateText.innerText = stateStr;
        this.enemyCount.innerText = enemies;
        this.enemyMax.innerText = maxEnemies;
    }

    showLevelUpMenu(choices, onSelect) {
        this.isPaused = true;
        document.body.classList.remove('game-active'); // 레벨업 시 커서 보이게 복구
        
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
                document.body.classList.add('game-active'); // 게임으로 돌아가면 다시 숨김
                this.isPaused = false;
            });
            this.cardsContainer.appendChild(card);
        });
    }

    showGameOver(onRestart) {
        this.isGameOver = true;
        document.body.classList.remove('game-active'); // 게임 오버 시 커서 보이게 복구
        
        this.gameOverScreen.classList.remove('hidden');
        this.restartBtn.onclick = () => {
            this.gameOverScreen.classList.add('hidden');
            document.body.classList.add('game-active'); // 재시작 시 다시 숨김
            this.isGameOver = false;
            onRestart();
        };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('game-container');
    const gameCanvas = document.getElementById('game-canvas');
    const uiCanvas = document.getElementById('ui-canvas');

    const audioToggleBtn = document.getElementById('audio-toggle');
    if (audioToggleBtn) {
        audioToggleBtn.addEventListener('click', () => {
            const isEnabled = AudioSys.toggle();
            audioToggleBtn.innerText = isEnabled ? '🔊' : '🔇';
        });
    }

    const uiManager = new UIManager();
    const inputManager = new InputManager(container);
    const renderer = new Renderer(gameCanvas, uiCanvas);
    
    const progression = new Progression(uiManager);
    let game = new Game(540, 960, progression);

    // 카메라 흔들림 연동
    const setupGameCallbacks = () => {
        game.onShake = (magnitude, duration) => {
            renderer.triggerShake(magnitude, duration);
        };
        game.onGameOver = () => {
            uiManager.showGameOver(() => {
                // 게임 재시작 로직
                progression.level = 1;
                progression.xp = 0;
                progression.xpToNextLevel = 5;
                game = new Game(540, 960, progression);
                setupGameCallbacks();
            });
        };
    };
    setupGameCallbacks();

    let lastTime = performance.now();

    function loop(currentTime) {
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // 레벨업 시 게임 일시정지 (렌더링만 유지)
        if (!uiManager.isPaused && !uiManager.isGameOver) {
            game.update(dt, inputManager);
            
            const maxEnemies = 10 + progression.level * 2;
            uiManager.updateHUD(
                progression.level, 
                progression.xp, 
                progression.xpToNextLevel,
                inputManager.state,
                game.enemies.length,
                maxEnemies,
                game.player.hp,
                game.player.maxHp
            );
        }

        renderer.clear();
        renderer.drawGame(game, dt);
        
        // 일시정지 중이 아닐 때만 UI(마우스 오라) 그림
        if (!uiManager.isPaused && !uiManager.isGameOver) {
            renderer.drawUI(inputManager);
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
});
