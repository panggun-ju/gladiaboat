// src/progression.js
import { getRandomItems } from './items.js';

export class Progression {
    constructor(uiManager) {
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 5; // 첫 레벨업까지 적 5마리
        
        // 레벨업 UI 표시 콜백
        this.onLevelUpUI = uiManager.showLevelUpMenu.bind(uiManager);
    }

    addXp(amount, player) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.level++;
            // 레벨업 요구량 점진적 증가
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
            
            this.triggerLevelUp(player);
        }
    }

    triggerLevelUp(player) {
        // 무작위 아이템 3개 뽑기
        const choices = getRandomItems(3);
        
        // UI 오버레이 표시 (선택할 때까지 게임은 일시정지됨)
        this.onLevelUpUI(choices, (selectedItem) => {
            // 선택 콜백
            selectedItem.apply(player);
        });
    }
}