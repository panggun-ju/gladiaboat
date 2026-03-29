// src/input.js
import { Vec2 } from './math.js';

export const InputState = {
    IDLE: 'idle',
    ROWING: 'rowing',       // 좌클릭 드래그
    SLASHING: 'slashing',   // 우클릭 드래그
    BLOCKING: 'blocking'    // 양쪽 클릭 동시
};

export class InputManager {
    constructor(containerElement) {
        this.container = containerElement;
        
        // 현재 커서 위치
        this.mousePos = new Vec2(0, 0);
        
        // 드래그 시작 위치
        this.dragStartPos = null;
        
        // 클릭 상태
        this.leftDown = false;
        this.rightDown = false;
        
        // 현재 인식된 논리적 입력 상태
        this.state = InputState.IDLE;
        
        // 양쪽 클릭 판정을 위한 타이머 관련 (이번 프레임에서 눌렸는지)
        this.leftDownTime = 0;
        this.rightDownTime = 0;
        this.DUAL_PRESS_WINDOW = 100; // ms

        this.initEvents();
    }

    initEvents() {
        // 브라우저 기본 우클릭 메뉴 차단 (화면 전체 적용)
        window.addEventListener('contextmenu', e => {
            e.preventDefault();
        });

        this.container.addEventListener('mousedown', e => this.handleMouseDown(e));
        // window에 걸어서 화면 밖으로 나가도 드래그 해제 인식되게 함
        window.addEventListener('mouseup', e => this.handleMouseUp(e));
        window.addEventListener('mousemove', e => this.handleMouseMove(e));
    }

    updateRect() {
        this.rect = this.container.getBoundingClientRect();
    }

    getRelativePos(clientX, clientY) {
        if (!this.rect) this.updateRect();
        const scaleX = this.container.clientWidth / this.rect.width;
        const scaleY = this.container.clientHeight / this.rect.height;
        return new Vec2(
            (clientX - this.rect.left) * scaleX,
            (clientY - this.rect.top) * scaleY
        );
    }

    handleMouseMove(e) {
        if (!this.rect) this.updateRect();
        // 컨테이너 범위 내에서만 좌표 추적, 밖으로 나가면 클램핑 또는 자유롭게 둠
        // 여기선 시각화를 위해 자유롭게 둠
        this.mousePos = this.getRelativePos(e.clientX, e.clientY);
    }

    handleMouseDown(e) {
        const now = performance.now();
        
        if (e.button === 0) {
            this.leftDown = true;
            this.leftDownTime = now;
        } else if (e.button === 2) {
            this.rightDown = true;
            this.rightDownTime = now;
        }

        // 드래그 시작점 기록 (새로운 액션이 시작될 때)
        if (this.state === InputState.IDLE) {
            this.dragStartPos = this.mousePos.clone();
        }

        this.evalState();
    }

    handleMouseUp(e) {
        if (e.button === 0) this.leftDown = false;
        if (e.button === 2) this.rightDown = false;

        this.evalState();
    }

    evalState() {
        const now = performance.now();

        if (!this.leftDown && !this.rightDown) {
            this.state = InputState.IDLE;
            this.dragStartPos = null;
            return;
        }

        // 양쪽 다 눌려있으면 BLOCKING 검사
        if (this.leftDown && this.rightDown) {
            // 두 버튼이 비슷한 시간에 눌렸거나, 이미 한쪽이 눌린 상태에서 다른 쪽이 눌렸을 때
            // 간단하게 양쪽 다 down이면 무조건 BLOCKING으로 취급.
            this.state = InputState.BLOCKING;
            this.dragStartPos = null; // 방어 중엔 드래그 안 함
            return;
        }

        // 하나만 눌려있는 경우
        if (this.leftDown && !this.rightDown) {
            this.state = InputState.ROWING;
            if (!this.dragStartPos) this.dragStartPos = this.mousePos.clone();
        } else if (!this.leftDown && this.rightDown) {
            this.state = InputState.SLASHING;
            if (!this.dragStartPos) this.dragStartPos = this.mousePos.clone();
        }
    }

    // 게임 로직이나 UI가 사용할 드래그 벡터 반환 함수
    getDragVector() {
        if (!this.dragStartPos) return new Vec2(0, 0);
        return this.mousePos.sub(this.dragStartPos);
    }
}