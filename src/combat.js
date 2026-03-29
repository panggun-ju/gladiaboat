// src/combat.js
import { Vec2 } from './math.js';

// 부채꼴(아크) 형태의 공격 히트박스
export class SlashArc {
    constructor(originPos, directionAngle, radius, arcAngle) {
        this.origin = originPos.clone();
        this.angle = directionAngle;
        this.radius = radius;
        this.arcAngle = arcAngle; // 부채꼴의 총 각도 (예: Math.PI/2 = 90도)
    }

    // 대상이 이 부채꼴 히트박스 안에 있는지 검사
    contains(targetPos, targetRadius) {
        const dist = Vec2.distance(this.origin, targetPos);
        // 대상이 반경 + 대상 크기 이내에 있는지
        if (dist > this.radius + targetRadius) return false;

        // 각도 검사 (대상을 향하는 각도와 부채꼴 중심 각도 간의 차이)
        const dirToTarget = targetPos.sub(this.origin);
        const angleToTarget = dirToTarget.heading();
        
        // 각도 차이 정규화 (-PI ~ PI)
        let diff = angleToTarget - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= this.arcAngle / 2;
    }

    draw(ctx, color = 'rgba(255, 50, 50, 0.4)') {
        ctx.save();
        ctx.translate(this.origin.x, this.origin.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.radius, -this.arcAngle / 2, this.arcAngle / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
