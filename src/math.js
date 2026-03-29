// src/math.js

export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vec2(this.x * s, this.y * s); }
    
    magSq() { return this.x * this.x + this.y * this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vec2(0, 0) : new Vec2(this.x / m, this.y / m);
    }

    // 두 벡터의 내적
    dot(v) { return this.x * v.x + this.y * v.y; }
    
    // 외적의 Z 컴포넌트 (회전 방향 결정에 유용)
    cross(v) { return this.x * v.y - this.y * v.x; }

    // 각도 (라디안)
    heading() { return Math.atan2(this.y, this.x); }

    // 특정 각도(라디안)만큼 회전된 새 벡터 반환
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    clone() { return new Vec2(this.x, this.y); }

    static distance(v1, v2) {
        return v1.sub(v2).mag();
    }
}

// 편의 유틸 함수들
export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
export const lerp = (start, end, amt) => (1 - amt) * start + amt * end;
