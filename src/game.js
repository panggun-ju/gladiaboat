// src/game.js
// 게임의 전체 상태를 관리하고 업데이트합니다.

import { Player, Enemy, BoatState } from './entities.js';
import { Progression } from './progression.js';

export class Game {
    constructor(width, height, progression) {
        this.width = width;
        this.height = height;
        this.progression = progression;
        
        // 플레이어를 화면 중앙에 스폰
        this.player = new Player(width / 2, height / 2);
        
        this.enemies = [];
        this.particles = [];
        this.spawnTimer = 2.0; // 2초 뒤 첫 적 생성
        this.baseSpawnRate = 3.0; // 기본 스폰 주기
        this.onShake = null; // 렌더러에 흔들림 트리거용 콜백
    }

    createWake(boat) {
        // 배가 움직일 때 뒤로 물결 파티클 생성
        if (boat.vel.magSq() > 100) {
            const backVec = boat.getForwardVec().scale(-1);
            // 뱃미 위치
            const sternX = boat.pos.x + backVec.x * (boat.height/2);
            const sternY = boat.pos.y + backVec.y * (boat.height/2);
            
            // 약간의 랜덤 오프셋
            this.particles.push({
                x: sternX + (Math.random() - 0.5) * 15,
                y: sternY + (Math.random() - 0.5) * 15,
                size: Math.random() * 4 + 2,
                life: 0.8,
                maxLife: 0.8
            });
        }
    }

    update(dt, inputManager) {
        // 플레이어 업데이트
        this.player.update(dt, inputManager);
        this.createWake(this.player);

        // 레벨이 오를수록 스폰 주기 감소 (더 어려워짐)
        const currentSpawnRate = Math.max(0.5, this.baseSpawnRate - (this.progression.level * 0.2));
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = currentSpawnRate;
        }

        // 적 업데이트 및 충돌(공격) 판정
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.updateAI(dt, this.player);

            // 1. 플레이어의 공격에 적이 맞았는지 확인
            if (this.player.currentSlash && this.player.slashTimer > this.player.SLASH_COOLDOWN - this.player.SLASH_DURATION - 0.05) {
                if (this.player.currentSlash.contains(enemy.pos, enemy.width/2)) {
                    // 적 타격 이펙트 (화면 흔들림)
                    if(this.onShake) this.onShake(10, 0.2);

                    // 적 넉백
                    const knockbackDir = enemy.pos.sub(this.player.pos).normalize();
                    enemy.applyForce(knockbackDir.scale(500));
                    enemy.hp -= 1;
                    
                    if (enemy.hp <= 0) {
                        this.enemies.splice(i, 1);
                        // 적 처치 시 경험치 1 획득
                        this.progression.addXp(1, this.player);
                        continue;
                    }
                }
            }

            // 2. 적의 공격에 플레이어가 맞았는지 확인 (패링 포함)
            if (enemy.currentSlash && enemy.slashTimer > enemy.SLASH_DURATION - 0.05) {
                if (enemy.currentSlash.contains(this.player.pos, this.player.width/2)) {
                    // 플레이어 피격 처리
                    if (this.player.state === BoatState.BLOCKING) {
                        // 패링(Perfect Parry)인지 방어(Block)인지 판정 필요.
                        // 일단 BLOCKING 상태면 데미지 무효화 + 약간의 밀림
                        if(this.onShake) this.onShake(15, 0.3); // 패링 성공 시 더 크게 흔들림
                        
                        const pushDir = this.player.pos.sub(enemy.pos).normalize();
                        this.player.applyForce(pushDir.scale(300));
                        
                        // 패링 로직: 적을 기절(Stun)시킴
                        enemy.stunTimer = 1.5;
                        enemy.aiState = 'stunned';
                        enemy.currentSlash = null; // 적 공격 취소
                        enemy.slashTimer = 0;
                        
                        // 아이템 효과 연동 (파도 생성기)
                        if (this.player.hasWaveMaker) {
                            this.triggerWavePulse(this.player.pos);
                        }
                        
                    } else {
                        // 실제 피격
                        if(this.onShake) this.onShake(25, 0.4); // 맞으면 엄청 크게 흔들림
                        
                        this.player.color = '#ff0000'; // 임시 피격 표시
                        setTimeout(() => this.player.color = '#3b8b5a', 100);
                        const pushDir = this.player.pos.sub(enemy.pos).normalize();
                        // 아이템: 견고한 선체 적용 시 넉백 반감
                        const kbResist = this.player.knockbackResistance || 1.0;
                        this.player.applyForce(pushDir.scale(400 * kbResist));
                        
                        // 아이템: 크라켄 먹물
                        if (this.player.hasKrakenInk) {
                            enemy.stunTimer = 2.0; // 적 기절
                        }
                    }
                }
            }
        }

        // 바운더리 처리
        this.constrainPlayer();
    }

    spawnEnemy() {
        // 화면 테두리 근처에서 스폰
        const padding = 50;
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? padding : this.width - padding;
            y = Math.random() * this.height;
        } else {
            x = Math.random() * this.width;
            y = Math.random() < 0.5 ? padding : this.height - padding;
        }
        this.enemies.push(new Enemy(x, y));
    }

    constrainPlayer() {
        const p = this.player.pos;
        const padding = 30;
        if (p.x < padding) p.x = padding;
        if (p.x > this.width - padding) p.x = this.width - padding;
        if (p.y < padding) p.y = padding;
        if (p.y > this.height - padding) p.y = this.height - padding;
    }
}