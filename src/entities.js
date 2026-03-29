// src/entities.js
import { Vec2 } from './math.js';
import { InputState } from './input.js';
import { SlashArc } from './combat.js';

// 보트의 공통 상태 머신
export const BoatState = {
    IDLE: 'idle',
    ROWING: 'rowing',
    ATTACKING: 'attacking',
    BLOCKING: 'blocking',
    STUNNED: 'stunned',
    DEAD: 'dead'
};

export class Boat {
    constructor(x, y) {
        this.pos = new Vec2(x, y);
        this.vel = new Vec2(0, 0);
        this.angle = -Math.PI / 2; // 초기 방향: 위쪽(북쪽)
        this.angularVel = 0;

        // 물리 상수
        this.WATER_DRAG = 2.5;     // 물의 마찰력 (선형)
        this.ANGULAR_DRAG = 4.0;   // 회전 마찰력
        this.MAX_SPEED = 250;      // 최대 속도

        this.state = BoatState.IDLE;
        
        // 크기 (렌더링용 임시)
        this.width = 30;
        this.height = 60;
    }

    // 보트가 바라보는 전방 벡터
    getForwardVec() {
        return new Vec2(Math.cos(this.angle), Math.sin(this.angle));
    }

    // 보트의 측면 벡터 (우측)
    getRightVec() {
        return new Vec2(Math.cos(this.angle + Math.PI/2), Math.sin(this.angle + Math.PI/2));
    }

    applyForce(forceVec) {
        this.vel = this.vel.add(forceVec);
    }

    applyTorque(torque) {
        this.angularVel += torque;
    }

    updatePhysics(dt) {
        // 물의 마찰력 적용 (감속)
        this.vel = this.vel.scale(1 - Math.min(1, this.WATER_DRAG * dt));
        this.angularVel *= (1 - Math.min(1, this.ANGULAR_DRAG * dt));

        // 최대 속도 제한
        if (this.vel.mag() > this.MAX_SPEED) {
            this.vel = this.vel.normalize().scale(this.MAX_SPEED);
        }

        // 위치 및 각도 업데이트
        this.pos = this.pos.add(this.vel.scale(dt));
        this.angle += this.angularVel * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 배 몸체 (간단한 타원 또는 사각형)
        ctx.fillStyle = '#8b5a2b'; // 나무색
        ctx.beginPath();
        ctx.ellipse(0, 0, this.height/2, this.width/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 뱃머리 방향 표시
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.height/2 - 5, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class Player extends Boat {
    constructor(x, y) {
        super(x, y);
        // 플레이어 전용 속성 추가 가능 (경험치 등)
        this.ROW_THRUST_SCALE = 15; // 드래그 길이에 비례한 추진력
        this.ROW_TORQUE_SCALE = 0.08; // 드래그 각도에 비례한 회전력
        
        // 전투 관련 속성
        this.SLASH_COOLDOWN = 0.5; // 공격 쿨타임 (초)
        this.SLASH_DURATION = 0.2; // 히트박스 유지 시간 (초)
        this.slashTimer = 0;
        this.currentSlash = null; // 활성화된 SlashArc 객체
        this.wasSlashing = false;

        // 렌더링 색상 오버라이드
        this.color = '#3b8b5a';
    }

    update(dt, inputManager) {
        // 타이머 감소
        if (this.slashTimer > 0) this.slashTimer -= dt;

        // 공격 유지 시간이 끝났으면 히트박스 제거
        if (this.currentSlash && this.slashTimer < this.SLASH_COOLDOWN - this.SLASH_DURATION) {
            this.currentSlash = null;
        }

        // 1. 입력 상태에 따른 상태 머신 전환
        // 단, 쿨타임 중이거나 공격 모션 중에는 다른 행동 전환 제한
        const isAttackingNow = this.slashTimer > this.SLASH_COOLDOWN - this.SLASH_DURATION;
        
        if (isAttackingNow) {
            this.state = BoatState.ATTACKING;
        } else if (inputManager.state === InputState.BLOCKING) {
            this.state = BoatState.BLOCKING;
        } else if (inputManager.state === InputState.SLASHING) {
            this.state = BoatState.ATTACKING;
        } else if (inputManager.state === InputState.ROWING) {
            this.state = BoatState.ROWING;
        } else {
            this.state = BoatState.IDLE;
        }

        // --- 공격 발동 로직 ---
        // 우클릭 드래그(SLASHING) 상태에서 드래그를 놨을 때(IDLE로 돌아갔을 때) 공격을 확정발동 시킨다.
        const isSlashingInput = (inputManager.state === InputState.SLASHING);
        if (this.wasSlashing && !isSlashingInput && this.slashTimer <= 0) {
            // 방금 우클릭을 놓았고 쿨타임이 돌았다면 공격 발사
            // 드래그 했던 벡터 방향으로 검을 휘두름
            const dragVec = inputManager.getDragVector();
            
            // 드래그 방향(상대적)을 계산. 너무 짧으면 배의 전방으로 때림
            let slashAngle = this.angle;
            if (dragVec && dragVec.mag() > 20) {
                 // 드래그 방향 벡터 각도
                 slashAngle = dragVec.heading();
                 
                 // 배의 정면을 기준으로 좌우 최대 90도(PI/2) 내에서만 공격 가능하도록 클램프
                 let angleDiff = slashAngle - this.angle;
                 while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                 while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                 
                 const maxAngle = Math.PI / 2;
                 if (angleDiff > maxAngle) slashAngle = this.angle + maxAngle;
                 if (angleDiff < -maxAngle) slashAngle = this.angle - maxAngle;
            }

            // 부채꼴 영역 생성 (반지름 80, 부채꼴 각도 90도)
            this.currentSlash = new SlashArc(this.pos, slashAngle, 80, Math.PI / 2);
            this.slashTimer = this.SLASH_COOLDOWN;
        }
        this.wasSlashing = isSlashingInput;


        // 2. 상태에 따른 물리 행동 처리
        // 공격 중(이펙트 유지 중)일 때는 노를 저을 수 없음 (이동 불가 패널티)
        if (this.state === BoatState.ROWING && !isAttackingNow) {
            const dragVec = inputManager.getDragVector();
            const dragDist = dragVec.mag();
            
            // 드래그가 너무 짧으면 무시
            if (dragDist > 10) {
                // 드래그 벡터의 방향에 따라 보트에 추진력과 회전력을 가함
                // 마우스를 뒤로 당기면(배의 후방으로 드래그) 앞으로 나아가는 직관적인 노 젓기
                
                // 역방향 벡터 (우리가 노를 물속에 박고 당기는 방향의 반대 = 배가 나아갈 방향)
                const thrustDir = dragVec.scale(-1).normalize();
                const forward = this.getForwardVec();
                const right = this.getRightVec();

                // 전진 성분 (내적)
                const forwardComponent = thrustDir.dot(forward);
                // 회전 성분 (외적/우측 벡터와의 내적)
                const sideComponent = thrustDir.dot(right);

                // 추진력 적용 (드래그 길이에 비례하되 최대치 캡)
                const appliedThrust = Math.min(dragDist, 150) * this.ROW_THRUST_SCALE * dt;
                
                // 후진(뒤로 젓기)보다 전진의 효율이 더 좋도록 처리할 수도 있음
                // 하지만 직관적 재미를 위해 단순히 힘 벡터를 더함
                const force = thrustDir.scale(appliedThrust);
                this.applyForce(force);

                // 회전력 적용
                // 드래그를 양옆으로 하면 배가 그 방향으로 꺾임
                const appliedTorque = sideComponent * Math.min(dragDist, 100) * this.ROW_TORQUE_SCALE * dt;
                this.applyTorque(appliedTorque);
            }
        }

        // 블로킹, 어태킹 중에는 물리적 이동 입력(노 젓기) 불가
        
        // 3. 물리 엔진 틱 (관성에 의한 이동)
        this.updatePhysics(dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 배 몸체
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.height/2, this.width/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 뱃머리
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.height/2 - 5, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // 히트박스 렌더링 (보트의 로컬 좌표계가 아닌 월드 좌표계에 그림)
        if (this.currentSlash) {
            this.currentSlash.draw(ctx);
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 상태별 오라 시각화 (임시)
        if (this.state === BoatState.BLOCKING) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.height/2 + 10, this.width/2 + 10, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

export const EnemyState = {
    APPROACH: 'approach',
    TELEGRAPHING: 'telegraphing',
    ATTACKING: 'attacking',
    STUNNED: 'stunned'
};

export class Enemy extends Boat {
    constructor(x, y) {
        super(x, y);
        this.color = '#8b2b2b'; // 붉은색 계열
        this.aiState = EnemyState.APPROACH;
        
        this.hp = 3;
        
        // AI 파라미터
        this.attackRange = 70;
        this.telegraphTimer = 0;
        this.TELEGRAPH_DURATION = 0.8; // 0.8초간 공격 예고
        
        // 공격 파라미터
        this.SLASH_DURATION = 0.2;
        this.slashTimer = 0;
        this.currentSlash = null;
        this.stunTimer = 0;
    }

    updateAI(dt, player) {
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) this.aiState = EnemyState.APPROACH;
            else {
                this.state = BoatState.STUNNED;
                this.updatePhysics(dt);
                return;
            }
        }

        // 공격 히트박스 유지 처리
        if (this.slashTimer > 0) {
            this.slashTimer -= dt;
            if (this.slashTimer <= 0) {
                this.currentSlash = null;
                this.aiState = EnemyState.APPROACH; // 공격 끝나면 다시 접근
            }
        }

        const distToPlayer = Vec2.distance(this.pos, player.pos);

        if (this.aiState === EnemyState.APPROACH) {
            this.state = BoatState.ROWING;
            
            // 플레이어를 향하는 방향 벡터
            const dirToPlayer = player.pos.sub(this.pos).normalize();
            const forward = this.getForwardVec();
            
            // 전진 추력
            this.applyForce(forward.scale(400 * dt));

            // 방향 회전 (외적을 이용해 목표를 향해 돌림)
            const cross = forward.cross(dirToPlayer);
            this.applyTorque(cross * 8 * dt);

            // 사거리에 들어오면 공격 준비
            if (distToPlayer < this.attackRange) {
                this.aiState = EnemyState.TELEGRAPHING;
                this.telegraphTimer = this.TELEGRAPH_DURATION;
                this.state = BoatState.IDLE; // 공격 전조 중엔 멈춤
            }
        } 
        else if (this.aiState === EnemyState.TELEGRAPHING) {
            this.state = BoatState.IDLE;
            this.telegraphTimer -= dt;
            
            // 공격 예고 중에도 방향은 플레이어를 향하도록 살짝 보정 가능
            const dirToPlayer = player.pos.sub(this.pos).normalize();
            const forward = this.getForwardVec();
            const cross = forward.cross(dirToPlayer);
            this.applyTorque(cross * 5 * dt);

            if (this.telegraphTimer <= 0) {
                // 공격 발동!
                this.aiState = EnemyState.ATTACKING;
                this.state = BoatState.ATTACKING;
                this.slashTimer = this.SLASH_DURATION;
                // 적도 플레이어와 동일한 부채꼴 공격
                this.currentSlash = new SlashArc(this.pos, this.angle, 75, Math.PI / 2);
            }
        }

        this.updatePhysics(dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 공격 예고(Telegraphing) 시각화: 붉게 깜빡임
        let drawColor = this.color;
        if (this.aiState === EnemyState.TELEGRAPHING) {
            const blinkRate = 15; // 깜빡임 속도
            if (Math.floor(this.telegraphTimer * blinkRate) % 2 === 0) {
                drawColor = '#ff5555';
            }
        } else if (this.state === BoatState.STUNNED) {
            drawColor = '#555555'; // 기절 시 회색
        }

        // 배 몸체
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.height/2, this.width/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 뱃머리
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.height/2 - 5, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (this.currentSlash) {
            this.currentSlash.draw(ctx, 'rgba(255, 100, 0, 0.6)');
        }
    }
}