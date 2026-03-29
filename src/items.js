// src/items.js
// 기발한 로그라이크 아이템/업그레이드 목록 정의

export const ITEMS = [
    {
        id: 'twin_oars',
        name: '쌍발 노 (Twin Oars)',
        desc: '노 젓기의 추진력과 회전력이 대폭 증가합니다. 치고 빠지기에 능해집니다.',
        apply: (player) => {
            player.ROW_THRUST_SCALE *= 1.3;
            player.ROW_TORQUE_SCALE *= 1.3;
        }
    },
    {
        id: 'longsword',
        name: '장검 (Longsword)',
        desc: '칼질의 사거리(반경)가 늘어납니다. 더 멀리서 안전하게 적을 벱니다.',
        apply: (player) => {
            player.slashRadius = (player.slashRadius || 80) + 30; 
            // entities.js의 하드코딩된 80 대신 이 변수 사용하도록 수정 필요
        }
    },
    {
        id: 'spiked_prow',
        name: '가시 돋친 뱃머리 (Spiked Prow)',
        desc: '빠른 속도로 적과 충돌하면 데미지를 입히고 튕겨냅니다.',
        apply: (player) => {
            player.hasSpikedProw = true;
        }
    },
    {
        id: 'wave_maker',
        name: '파도 생성기 (Wave Maker)',
        desc: '적의 공격을 패링할 때 거대한 파동을 일으켜 주변 적들을 모두 밀쳐냅니다.',
        apply: (player) => {
            player.hasWaveMaker = true;
        }
    },
    {
        id: 'kraken_ink',
        name: '크라켄의 먹물 (Kraken Ink)',
        desc: '피격 시 먹물을 뿜어 주변 적의 기절 시간을 늘립니다.',
        apply: (player) => {
            player.hasKrakenInk = true;
        }
    },
    {
        id: 'sturdy_hull',
        name: '견고한 선체 (Sturdy Hull)',
        desc: '피격 시 뒤로 밀려나는 거리(넉백)가 줄어들고 최대 체력이 증가합니다.',
        apply: (player) => {
            player.hp = (player.hp || 5) + 2;
            player.knockbackResistance = 0.5; // 밀리는 힘 반감
        }
    }
];

export function getRandomItems(count = 3) {
    // 얕은 복사 후 셔플하여 앞에서 count개 뽑기
    const shuffled = [...ITEMS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}