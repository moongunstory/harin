/**
 * achievements.js
 * 업적(칭호) 시스템 및 클릭 트래커
 */

window.AchievementAPI = (() => {
    const STORAGE_KEY = 'mbti_achievements';
    const EQUIPPED_KEY = 'mbti_equipped_title';

    // 클릭 타임스탬프 큐 (1분 내 클릭 수 측정용)
    const clickTimestamps = [];
    const clickCounts = { E:0, I:0, S:0, N:0, T:0, F:0, J:0, P:0 };
    let totalClicks = 0;

    // 업적 정의
    const ACHIEVEMENTS = [
        // 꾸준함 계열
        { id: 'first_click',   title: '⚡ 첫 클릭의 설렘',    desc: '처음으로 버튼을 클릭했다.',                       check: () => totalClicks >= 1 },
        { id: 'click_100',     title: '💪 손가락이 근질근질',  desc: '누적 클릭 100회 달성!',                          check: () => totalClicks >= 100 },
        { id: 'click_500',     title: '🔥 클릭 중독자',       desc: '누적 클릭 500회 달성!',                          check: () => totalClicks >= 500 },
        { id: 'click_1000',    title: '🌟 클릭 장인',         desc: '누적 클릭 1,000회를 달성했다!',                   check: () => totalClicks >= 1000 },
        { id: 'click_5000',    title: '👑 클릭의 신',         desc: '누적 클릭 5,000회! 손가락이 남아있나?',           check: () => totalClicks >= 5000 },

        // 성향별 계열
        { id: 'e_master',      title: '🗣️ 외향성의 지배자',   desc: 'E 버튼 500번 클릭',                              check: () => clickCounts.E >= 500 },
        { id: 'i_master',      title: '🌙 혼자가 편한 자',    desc: 'I 버튼 500번 클릭',                              check: () => clickCounts.I >= 500 },
        { id: 's_master',      title: '📐 현실주의자',        desc: 'S 버튼 500번 클릭',                              check: () => clickCounts.S >= 500 },
        { id: 'n_master',      title: '🌌 몽상가',            desc: 'N 버튼 500번 클릭',                              check: () => clickCounts.N >= 500 },
        { id: 't_master',      title: '🧠 냉철한 논리주의자', desc: 'T 버튼 500번 클릭',                              check: () => clickCounts.T >= 500 },
        { id: 'f_master',      title: '💞 공감력 배터리',     desc: 'F 버튼 500번 클릭',                              check: () => clickCounts.F >= 500 },
        { id: 'j_master',      title: '📋 계획표의 달인',     desc: 'J 버튼 500번 클릭',                              check: () => clickCounts.J >= 500 },
        { id: 'p_master',      title: '🌊 즉흥의 신',         desc: 'P 버튼 500번 클릭',                              check: () => clickCounts.P >= 500 },

        // 스피드 계열 (1분 내 N번)
        { id: 'speed_30',      title: '🐇 두뇌 회전 빠름',   desc: '1분 내 30번 클릭 달성!',                         check: () => getClicksInLastMinute() >= 30 },
        { id: 'speed_100',     title: '⚡ 빛의 손가락',       desc: '1분 내 100번 클릭 달성!',                        check: () => getClicksInLastMinute() >= 100 },

        // 특수 / 히든 업적 계열
        { id: 'donator',       title: '💸 은혜 갚는 까치',    desc: '첫 후원을 완료했습니다!',                         check: () => false }, // 후원 시 수동 달성
        { id: 'makgora_win_5', title: '🔥 연승의 달인',       desc: '막고라 5연승 달성!',                             check: () => false, isHidden: true }, // 조건 충족 시 수동 달성
        { id: 'harin_insta',   title: '📸 진짜 팬',           desc: '하린이의 인스타그램을 방문했다.',                 check: () => false, isHidden: true },
    ];

    function getUnlockedSet() {
        try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
        catch(e) { return new Set(); }
    }

    function saveUnlocked(set) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    }

    function getClicksInLastMinute() {
        const now = Date.now();
        const cutoff = now - 60000;
        // 오래된 것 제거
        while(clickTimestamps.length && clickTimestamps[0] < cutoff) clickTimestamps.shift();
        return clickTimestamps.length;
    }

    function showToast(achievement) {
        const toast = document.getElementById('achievement-toast');
        const titleEl = document.getElementById('achievement-toast-title');
        const descEl = document.getElementById('achievement-toast-desc');
        const iconEl = toast ? toast.querySelector('div:first-child') : null;
        if(!toast || !titleEl || !descEl || !iconEl) return;

        if (achievement.isHidden) {
            if(window.soundManager) window.soundManager.playHiddenAchievement();
            toast.style.background = 'linear-gradient(135deg, rgba(40,10,15,0.95) 0%, rgba(200,30,50,0.85) 100%)';
            toast.style.border = '1px solid rgba(255, 218, 121, 0.8)';
            toast.style.boxShadow = '0 10px 40px rgba(230, 104, 60, 0.5)';
            iconEl.innerText = '✨';
            titleEl.innerHTML = `<span style="font-size:0.85rem; color:#ffda79; font-weight:bold; letter-spacing:1px; display:block; margin-bottom:4px; text-shadow:0 0 5px rgba(255,218,121,0.5);">✨ 히든 업적 달성! ✨</span><span style="font-size:1.2rem; font-weight:900; color:#fff;">${achievement.title}</span>`;
            descEl.style.color = '#fff';
            descEl.innerText = achievement.desc;
        } else {
            if(window.soundManager) window.soundManager.playAchievement();
            toast.style.background = 'rgba(20,20,30,0.97)';
            toast.style.border = '1px solid #f6c90e';
            toast.style.boxShadow = '0 10px 30px rgba(246,201,14,0.4)';
            iconEl.innerText = '🏆';
            titleEl.innerHTML = `<span style="font-size:0.8rem; color:#f6c90e; font-weight:bold; letter-spacing:1px; display:block; margin-bottom:4px;">업적 달성!</span><span style="font-size:1.1rem; font-weight:800; color:#fff;">${achievement.title}</span>`;
            descEl.style.color = '#ccc';
            descEl.innerText = achievement.desc;
        }
        
        // 등장 효과 설정
        toast.style.display = 'flex';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        toast.style.transition = 'all 0.5s cubic-bezier(0.2, 1.2, 0.3, 1)';
        
        // Reflow 강제 실행
        void toast.offsetWidth;

        // 나타나기 애니메이션 시작
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        // 3.5초 후 숨김 애니메이션
        const hideToast = () => {
            if (document.hidden) {
                // 화면이 가려져 있다면 다시 보일 때까지 대기
                const onVisChange = () => {
                    if (!document.hidden) {
                        document.removeEventListener('visibilitychange', onVisChange);
                        // 유저가 돌아오면 2초간 더 보여준 후 종료
                        setTimeout(hideToast, 2000);
                    }
                };
                document.addEventListener('visibilitychange', onVisChange);
                return;
            }

            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            
            setTimeout(() => {
                toast.style.display = 'none';
                toast.style.transform = ''; // 리셋
            }, 500); // 전환 시간 0.5초 대기
        };

        setTimeout(hideToast, 3500);
    }

    function checkAll() {
        const unlocked = getUnlockedSet();
        ACHIEVEMENTS.forEach(ach => {
            if(!unlocked.has(ach.id) && ach.check()) {
                unlocked.add(ach.id);
                saveUnlocked(unlocked);
                showToast(ach);
            }
        });
    }

    return {
        recordClick(type) {
            clickCounts[type] = (clickCounts[type] || 0) + 1;
            totalClicks++;
            clickTimestamps.push(Date.now());
            checkAll();
        },

        // 내 프로필 페이지 등에서 업적 목록을 반환
        getAll() {
            const unlocked = getUnlockedSet();
            return ACHIEVEMENTS
                .filter(a => !a.isHidden || unlocked.has(a.id)) // 히든은 미달성 시 숨김
                .map(a => ({ ...a, unlocked: unlocked.has(a.id) }));
        },

        getEquipped() {
            return localStorage.getItem(EQUIPPED_KEY) || '';
        },

        equipTitle(id) {
            const ach = ACHIEVEMENTS.find(a => a.id === id);
            const unlocked = getUnlockedSet();
            if(ach && unlocked.has(id)) {
                localStorage.setItem(EQUIPPED_KEY, ach.title);
                return ach.title;
            }
            return null;
        },

        // 조건 달성 외 수동(이벤트 등)으로 업적 잠금해제
        unlock(id) {
            const ach = ACHIEVEMENTS.find(a => a.id === id);
            const unlocked = getUnlockedSet();
            if (ach && !unlocked.has(id)) {
                unlocked.add(id);
                saveUnlocked(unlocked);
                showToast(ach);
            }
        },

        // 새 탭으로 이동할 경우, 유저가 다시 돌아올 때까지 대기 후 업적 띄움
        deferUnlock(id) {
            const ach = ACHIEVEMENTS.find(a => a.id === id);
            const unlocked = getUnlockedSet();
            if (!ach || unlocked.has(id)) return;

            let isUserAway = false;
            const checkAway = () => { isUserAway = true; };
            window.addEventListener('blur', checkAway, { once: true });

            setTimeout(() => {
                window.removeEventListener('blur', checkAway);
                if (isUserAway || document.hidden) {
                    const onReturn = () => {
                        if (!document.hidden) {
                            window.removeEventListener('focus', onReturn);
                            document.removeEventListener('visibilitychange', onReturn);
                            setTimeout(() => {
                                this.unlock(id);
                            }, 500);
                        }
                    };
                    window.addEventListener('focus', onReturn);
                    document.addEventListener('visibilitychange', onReturn);
                } else {
                    this.unlock(id);
                }
            }, 300);
        }
    };
})();
