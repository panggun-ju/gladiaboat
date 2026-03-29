// src/renderer.js
import { InputState } from './input.js';
import { clamp } from './math.js';

export class Renderer {
    constructor(gameCanvas, uiCanvas) {
        this.gameCanvas = gameCanvas;
        this.uiCanvas = uiCanvas;
        this.gameCtx = gameCanvas.getContext('2d');
        this.uiCtx = uiCanvas.getContext('2d');

        this.width = 540;
        this.height = 960;

        // 실제 렌더링 픽셀 사이즈 설정 (레티나 디스플레이 대응은 추후 고려, 일단 1:1)
        this.gameCanvas.width = this.width;
        this.gameCanvas.height = this.height;
        this.uiCanvas.width = this.width;
        this.uiCanvas.height = this.height;
        
        // 화면 흔들림(Screen Shake) 관련 변수
        this.shakeTime = 0;
        this.shakeMagnitude = 0;
    }

    triggerShake(magnitude, duration) {
        this.shakeMagnitude = magnitude;
        this.shakeTime = duration;
    }

    clear() {
        this.gameCtx.clearRect(0, 0, this.width, this.height);
        this.uiCtx.clearRect(0, 0, this.width, this.height);
    }

    drawGame(gameState, dt) {
        const ctx = this.gameCtx;
        
        // 화면 흔들림 적용
        let dx = 0, dy = 0;
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            const decay = clamp(this.shakeTime / 0.3, 0, 1); // 서서히 줄어듦
            dx = (Math.random() - 0.5) * 2 * this.shakeMagnitude * decay;
            dy = (Math.random() - 0.5) * 2 * this.shakeMagnitude * decay;
        }

        ctx.save();
        ctx.translate(dx, dy);

        // 배경 그리기
        ctx.fillStyle = '#1a4b6e';
        ctx.fillRect(-20, -20, this.width + 40, this.height + 40); // 흔들릴 때 배경 빈틈 방지

        // 뱃물결(Wake) 및 파티클 렌더링
        if (gameState.particles) {
            for (let i = gameState.particles.length - 1; i >= 0; i--) {
                const p = gameState.particles[i];
                p.life -= dt;
                if (p.life <= 0) {
                    gameState.particles.splice(i, 1);
                    continue;
                }
                ctx.fillStyle = `rgba(255, 255, 255, ${p.life / p.maxLife * 0.5})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 적 그리기
        if (gameState.enemies) {
            for (const enemy of gameState.enemies) {
                enemy.draw(ctx);
            }
        }

        // 플레이어 그리기
        if (gameState.player) {
            gameState.player.draw(ctx);
        }

        ctx.restore();
    }

    // 숏폼 핵심: 유저의 조작(고생)을 화면에 명확히 보여주는 UI 렌더링
    drawUI(inputManager) {
        const ctx = this.uiCtx;
        const state = inputManager.state;
        const pos = inputManager.mousePos;
        const startPos = inputManager.dragStartPos;

        // 드래그 궤적 그리기
        if ((state === InputState.ROWING || state === InputState.SLASHING) && startPos) {
            const dragVec = inputManager.getDragVector();
            const dist = dragVec.mag();
            
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(pos.x, pos.y);
            
            if (state === InputState.ROWING) {
                // 노 젓기: 파란색 고무줄 느낌
                ctx.strokeStyle = `rgba(0, 150, 255, ${Math.min(1, 0.4 + dist/200)})`;
                ctx.lineWidth = Math.min(15, 3 + dist/15); // 당길수록 두꺼워짐
                ctx.setLineDash([10, 5]); // 점선으로 힘을 주는 느낌
            } else {
                // 칼질: 붉은색 날카로운 선
                ctx.strokeStyle = `rgba(255, 50, 50, ${Math.min(1, 0.5 + dist/150)})`;
                ctx.lineWidth = Math.max(2, 10 - dist/30); // 당길수록 날카로워짐 (얇아짐)
                ctx.setLineDash([]);
            }
            
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.setLineDash([]);

            // 시작점 마커
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = state === InputState.ROWING ? '#0096ff' : '#ff3232';
            ctx.fill();
        }

        // 마우스 커서 파티클 그리기
        ctx.beginPath();
        if (state === InputState.IDLE) {
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill();
        } else if (state === InputState.ROWING) {
            ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#0096ff';
            ctx.fill();
            // 물결 파동 이펙트
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 25 + Math.sin(performance.now()/100)*5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (state === InputState.SLASHING) {
            ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#ff3232';
            ctx.fill();
            // 분노/불꽃 뾰족한 이펙트 (간단히 십자 모양)
            const s = 20;
            ctx.beginPath();
            ctx.moveTo(pos.x - s, pos.y); ctx.lineTo(pos.x + s, pos.y);
            ctx.moveTo(pos.x, pos.y - s); ctx.lineTo(pos.x, pos.y + s);
            ctx.strokeStyle = '#ff3232';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (state === InputState.BLOCKING) {
            // 패링/방어: 황금색 실드
            ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            
            // 육각형 실드 오라
            ctx.beginPath();
            const r = 35 + Math.sin(performance.now()/50)*5; // 빠르게 진동
            for(let i=0; i<6; i++) {
                const angle = (Math.PI / 3) * i + (performance.now()/500); // 회전
                const x = pos.x + r * Math.cos(angle);
                const y = pos.y + r * Math.sin(angle);
                if(i===0) ctx.moveTo(x,y);
                else ctx.lineTo(x,y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    }
}