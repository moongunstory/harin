/**
 * clicker.js 
 * 애플리케이션의 뼈대 로직 상태 관리
 */
const AppState = {
    ei: { left: 0, right: 0, leftType: 'E', rightType: 'I' },
    sn: { left: 0, right: 0, leftType: 'S', rightType: 'N' },
    tf: { left: 0, right: 0, leftType: 'T', rightType: 'F' },
    jp: { left: 0, right: 0, leftType: 'J', rightType: 'P' }
};

window.ClickerAPI = {
    combo: 0,
    isFever: false,
    comboTimeout: null,
    shareBuffMultiplier: 1,

    getState: () => AppState,
    
    // 초기 로딩 및 DB 동기화 시 데이터 매핑
    initLocalState: (dbData) => {
        if(!dbData) return;
        if(dbData.ei) { AppState.ei.left = dbData.ei.E || 0; AppState.ei.right = dbData.ei.I || 0; }
        if(dbData.sn) { AppState.sn.left = dbData.sn.S || 0; AppState.sn.right = dbData.sn.N || 0; }
        if(dbData.tf) { AppState.tf.left = dbData.tf.T || 0; AppState.tf.right = dbData.tf.F || 0; }
        if(dbData.jp) { AppState.jp.left = dbData.jp.J || 0; AppState.jp.right = dbData.jp.P || 0; }
    },

    clickTimestamps: [], // 매크로 감지용 큐

    pendingAdds: { ei: {E:0, I:0}, sn: {S:0, N:0}, tf: {T:0, F:0}, jp: {J:0, P:0} },
    syncInterval: null,

    // 클릭 시 로직 처리
    processClick: async (axis, type) => {
        const api = window.ClickerAPI;
        const now = Date.now();
        
        // 광클 매크로 방지: 1초(1000ms) 내에 25번 이상 클릭 시 무시
        api.clickTimestamps.push(now);
        api.clickTimestamps = api.clickTimestamps.filter(t => now - t < 1000);
        
        if (api.clickTimestamps.length > 25) {
            if (api.clickTimestamps.length === 26) {
                // 25번을 넘는 최초 시점에 한 번 토스트 띄우기
                if (window.AchievementAPI && window.AchievementAPI.showToast) {
                    window.AchievementAPI.showToast("⚠️ 너무 빠릅니다!", "잠시 쉬었다가 클릭해주세요 😅", "system");
                }
            }
            return; // 클릭 무시
        }

        // 콤보 로직 계산
        api.combo++;
        clearTimeout(api.comboTimeout);
        
        let multiplier = window.ClickerAPI.shareBuffMultiplier;
        
        // 50콤보 달성 시 피버 모드
        if (window.ClickerAPI.combo >= 50) {
            if (!window.ClickerAPI.isFever && window.soundManager) {
                window.soundManager.playFever();
            }
            window.ClickerAPI.isFever = true;
            multiplier *= 3;
            document.body.classList.add('fever-active');
        } else {
            window.ClickerAPI.isFever = false;
            document.body.classList.remove('fever-active');
        }

        // 20초간 클릭이 없으면 콤보 리셋 및 피버 타임 종료
        window.ClickerAPI.comboTimeout = setTimeout(() => {
            window.ClickerAPI.combo = 0;
            window.ClickerAPI.isFever = false;
            document.body.classList.remove('fever-active');
            if(window.UI && window.UI.updateCombo) {
                window.UI.updateCombo(0, 1);
            }
        }, 20000);

        if(window.UI && window.UI.updateCombo) {
            window.UI.updateCombo(window.ClickerAPI.combo, multiplier);
        }

        const adds = 1 * multiplier;

        // 프론트 단 업데이트 (Optimistic)
        if (type === AppState[axis].leftType) {
            AppState[axis].left += adds;
        } else {
            AppState[axis].right += adds;
        }

        // DB 묶음 처리 (Batching) 연산
        api.pendingAdds[axis][type] += adds;

        // 2초마다 모인 점수 한 번에 보내기 타이머 시작
        if (!api.syncInterval) {
            api.syncInterval = setInterval(() => {
                const userId = localStorage.getItem('mbti_userid');
                const nickname = localStorage.getItem('mbti_nickname');
                const mbtiType = localStorage.getItem('mbti_type');

                if (window.FirebaseAPI && window.FirebaseAPI.incrementCount) {
                    // 쌓인 점수 순회하며 0이 아닌 항목들 전송
                    ['ei', 'sn', 'tf', 'jp'].forEach(ax => {
                        Object.keys(api.pendingAdds[ax]).forEach(t => {
                            const accumulatedAdds = api.pendingAdds[ax][t];
                            if (accumulatedAdds > 0) {
                                window.FirebaseAPI.incrementCount(ax, t, userId, nickname, mbtiType, accumulatedAdds);
                                api.pendingAdds[ax][t] = 0; // 전송 후 초기화
                            }
                        });
                    });
                }
            }, 2000); // 2초 유지 스위트 스팟
        }
        
        return AppState[axis];
    }
};
