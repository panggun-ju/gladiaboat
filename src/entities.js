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
        
        // 노 젓기 쿨타임 (무한 연타 방지)
        this.rowCooldown = 0;

        // 렌더링 색상 오버라이드
        this.color = '#3b8b5a';
    }

    update(dt, inputManager) {
        // 타이머 감소
        if (this.slashTimer > 0) this.slashTimer -= dt;
        if (this.rowCooldown > 0) this.rowCooldown -= dt;

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
        if (this.state === BoatState.ROWING && !isAttackingNow && this.rowCooldown <= 0) {
            const dragVec = inputManager.getDragVector();
            const dragDist = dragVec.mag();
            
            // 드래그 시작 시점의 마우스 위치를 이용해 배의 왼쪽/오른쪽 판별
            const startPos = inputManager.dragStartPos;
            
            if (dragDist > 30) {
                // 당기는 방향의 반대(앞쪽)
                const thrustDir = dragVec.scale(-1).normalize();
                const forward = this.getForwardVec();
                const right = this.getRightVec();

                // 1. 배의 왼쪽/오른쪽 판별 (드래그 시작점 기준)
                const toStartPos = startPos.sub(this.pos);
                // 내적을 통해 우측(+)인지 좌측(-)인지 판별
                const isRightSide = toStartPos.dot(right) > 0;

                // 2. 추진력 (전진 성분만 추출. 뒤로 당길수록 커짐)
                // 카누 특성상 항상 배의 '정면'으로 힘이 가해짐
                const forwardComponent = Math.max(0, thrustDir.dot(forward));
                const appliedThrust = forwardComponent * Math.min(dragDist, 150) * this.ROW_THRUST_SCALE * 3.0; // 펄스형이므로 수치 높임
                
                this.applyForce(forward.scale(appliedThrust));

                // 3. 회전력 (카누 메커니즘)
                // 오른쪽 노를 저으면 좌회전(반시계, 음수 각도), 왼쪽 노를 저으면 우회전(시계, 양수 각도)
                const torqueDirection = isRightSide ? -1 : 1;
                // 강하게 당길수록 많이 꺾임
                const appliedTorque = torqueDirection * Math.min(dragDist, 150) * this.ROW_TORQUE_SCALE * 2.0;
                
                this.applyTorque(appliedTorque);

                // 4. 연속 드래그 방지 및 리듬감을 위한 쿨타임 (스트로크 한 번 후 잠깐 쉬어야 함)
                this.rowCooldown = 0.3; // 0.3초 쿨타임
                
                // 스트로크 완료 후 드래그 시작점을 초기화하여 다시 클릭/드래그 해야만 다음 노를 저을 수 있게 강제
                inputManager.dragStartPos = inputManager.mousePos.clone();
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