/**
 * main.js
 * 앱 부트스트랩 및 이벤트 초기화
 */

document.addEventListener('DOMContentLoaded', async () => {
    const security = window.SecurityUtils;

    // 채팅 UI 초기 세팅
    if (window.ChatUI) window.ChatUI.init();

    // 0. 유저 닉네임 체크 및 모달 처리
    let { userId, nickname, mbtiType, isGuest } = security.getStoredProfile();

    if (!userId || (!mbtiType && nickname !== 'Guest')) {
        document.getElementById('nickname-modal').classList.remove('hidden');
    }

    document.getElementById('nickname-submit').addEventListener('click', async () => {
        const input = document.getElementById('nickname-input').value.trim();
        const selectedMbti = document.getElementById('mbti-select').value;
        const errEl = document.getElementById('nickname-error');

        // 매 시도마다 에러 메시지 초기화
        if (errEl) errEl.innerText = "";

        if (!input && !selectedMbti) {
            if (errEl) errEl.innerText = "🛑 닉네임과 MBTI를 모두 입력해주세요!";
            return;
        } else if (!input) {
            if (errEl) errEl.innerText = "🛑 닉네임을 입력해주세요!";
            return;
        } else if (!selectedMbti) {
            if (errEl) errEl.innerText = "🛑 내 MBTI를 선택해주세요!";
            return;
        }

        nickname = security.sanitizeNickname(input);
        mbtiType = security.sanitizeMbti(selectedMbti);
        if (!nickname) {
            if (errEl) errEl.innerText = "🛑 2자 이상의 한글/영문/숫자만 가능해요.";
            return;
        }

        // 중복 검사
        const db = window.firebase?.apps?.length ? window.firebase.database() : null;
        if (db) {
            const nicknameLower = nickname.toLowerCase().replace(/\s+/g, '');
            const snap = await db.ref(`Nicknames/${nicknameLower}`).once('value');
            if (snap.exists()) {
                if (errEl) errEl.innerText = "🛑 이미 사용 중인 닉네임이에요.";
                return;
            }
        }

        userId = security.generateUserId('usr');
        ({ userId, nickname, mbtiType } = security.persistProfile({
            userId,
            nickname,
            mbtiType,
            isGuest: false
        }));
        document.getElementById('nickname-modal').classList.add('hidden');

        // 참가 직후 유저 등록 및 랭킹 즉시 갱신
        if (window.FirebaseAPI && window.FirebaseAPI.registerUser) {
            window.FirebaseAPI.registerUser(userId, nickname, mbtiType);
        }
        if (window.ChatUI) window.ChatUI.updateAuth();
        if (window.MakgoraAPI) window.MakgoraAPI.listenForInvites();
    });

    document.getElementById('nickname-skip').addEventListener('click', () => {
        ({ userId, nickname, mbtiType, isGuest } = security.persistProfile({
            userId: security.generateUserId('guest'),
            nickname: 'Guest',
            mbtiType: '',
            isGuest: true
        }));
        document.getElementById('nickname-modal').classList.add('hidden');
        if (window.ChatUI) window.ChatUI.updateAuth();
    });

    // 1. 초기 DB 연동 및 상태 불러오기
    const data = await window.FirebaseAPI.getInitialData();
    window.ClickerAPI.initLocalState(data);
    window.UI.updateTotalClicks(window.ClickerAPI.getState());
    if (window.UI.updateIllustration) window.UI.updateIllustration(window.ClickerAPI.getState());

    // 실시간 스탯 리스너
    if (window.FirebaseAPI.listenToGlobalStats) {
        window.FirebaseAPI.listenToGlobalStats((globalStats) => {
            window.ClickerAPI.initLocalState(globalStats);
            const axes = ['ei', 'sn', 'tf', 'jp'];
            axes.forEach(axis => {
                const state = window.ClickerAPI.getState()[axis];
                window.UI.updateGauge(axis, state.left, state.right);
            });
            window.UI.updateTotalClicks(window.ClickerAPI.getState());
            if (window.UI.updateIllustration) window.UI.updateIllustration(window.ClickerAPI.getState());
        });
    } else {
        // Fallback
        const axes = ['ei', 'sn', 'tf', 'jp'];
        axes.forEach(axis => {
            const state = window.ClickerAPI.getState()[axis];
            window.UI.updateGauge(axis, state.left, state.right);
        });
        if (window.UI.updateIllustration) window.UI.updateIllustration(window.ClickerAPI.getState());
    }

    // 실시간 MVP 랭킹 리스너
    if (window.FirebaseAPI.listenToRanking) {
        window.FirebaseAPI.listenToRanking((users) => {
            window.UI.updateMVPRanking(users);
        });
    }

    // 사운드 토글 버튼 바인딩
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    if (btnToggleSound) {
        // 초기 렌더
        if (window.soundManager && window.soundManager.isMuted) {
            btnToggleSound.innerText = '🔇';
        }
        btnToggleSound.addEventListener('click', () => {
            if (window.soundManager) {
                const isMuted = window.soundManager.toggleMute();
                btnToggleSound.innerText = isMuted ? '🔇' : '🔊';
            }
        });
    }

    // 3. 버튼 클릭 이벤트 바인딩
    const buttons = document.querySelectorAll('.mbti-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (navigator.vibrate) navigator.vibrate(30);

            const row = btn.closest('.mbti-row');
            const axis = row.dataset.axis;
            const type = btn.dataset.type;

            if (window.soundManager) window.soundManager.playMbtiClick(type);
            const emoji = btn.querySelector('.icon').innerText;

            window.UI.showClickFeedback(btn, emoji);

            const newState = await window.ClickerAPI.processClick(axis, type);
            // Optimistic Update
            window.UI.updateGauge(axis, newState.left, newState.right);
            window.UI.updateTotalClicks(window.ClickerAPI.getState());
            if (window.UI.updateIllustration) window.UI.updateIllustration(window.ClickerAPI.getState());

            // 업적 체크
            if (window.AchievementAPI) window.AchievementAPI.recordClick(type);
        });
    });

    // 4. 랭킹 메인 3탭 전환
    const rankMainTabs = document.querySelectorAll('.rank-main-tab');
    const rankMainPanels = document.querySelectorAll('.rank-main-panel');
    rankMainTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            rankMainTabs.forEach(t => t.classList.remove('active'));
            rankMainPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById('rank-main-' + tab.dataset.main);
            if (target) target.classList.add('active');

            // 막고라 탭 클릭 시 랭킹 불러오기
            if (tab.dataset.main === 'makgora') {
                await loadMakgoraRankingUI();
            }
        });
    });

    // MBTI 서브탭 전환
    const mbtiSubTabs = document.querySelectorAll('.mbti-sub-tabs .rank-tab');
    const mbtiPanels = document.querySelectorAll('#rank-main-mbti .rank-panel');
    mbtiSubTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mbtiSubTabs.forEach(t => t.classList.remove('active'));
            mbtiPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('rank-' + tab.dataset.target);
            if (panel) panel.classList.add('active');
        });
    });

    // 막고라 랭킹 UI 렌더
    async function loadMakgoraRankingUI() {
        const list = document.getElementById('list-MAKGORA');
        if (!list) return;
        list.innerHTML = '<li style="color:#888;text-align:center;">불러오는 중...</li>';
        try {
            const data = await window.MakgoraAPI.loadMakgoraRanking();
            if (!data || data.length === 0) {
                list.innerHTML = '<li style="color:#888;text-align:center;padding:10px;">아직 막고라 기록이 없습니다 ⚔️</li>';
                return;
            }
            list.innerHTML = data.slice(0, 20).map((u, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const wr = u.wins + u.losses + u.draws > 0
                    ? Math.round(u.wins / (u.wins + u.losses + u.draws) * 100) : 0;
                const nicknameLabel = security.escapeHtml(security.sanitizeNickname(u.nickname) || '익명');
                const mbtiLabel = security.escapeHtml(security.sanitizeMbti(u.mbti) || '');
                return `<li class="makgora-rank-item" data-uid="${u.id}" data-nick="${nicknameLabel}" data-mbti="${mbtiLabel}" style="cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                    <span class="rank-badge rank-${i + 1}">${medal}</span>
                    <span class="rank-nick">${nicknameLabel} <small style="color:#888;">${mbtiLabel}</small></span>
                    <span class="rank-score">🏆${u.wins}승 💀${u.losses}패<small>${wr}%</small></span>
                </li>`;
            }).join('');

            // 프로필 열기 클릭 이벤트 부여
            list.querySelectorAll('.makgora-rank-item').forEach(li => {
                li.addEventListener('click', () => {
                    const uid = li.getAttribute('data-uid');
                    const nick = li.getAttribute('data-nick');
                    const mbti = li.getAttribute('data-mbti');
                    if (window.ProfileAPI && uid) {
                        window.ProfileAPI.openUserProfile(uid, nick, mbti);
                    }
                });
            });
        } catch (e) {
            list.innerHTML = '<li style="color:#888;text-align:center;">오류가 발생했습니다</li>';
        }
    }


    // 랭킹 하단 패널 토글 애니메이션
    const rankToggleBtn = document.getElementById('rank-toggle-btn');
    const rankSection = document.getElementById('rank-section');
    if (rankToggleBtn && rankSection) {
        rankToggleBtn.addEventListener('click', () => {
            rankSection.classList.toggle('collapsed');
        });
    }

    // 5. 바이럴 버프(공유) 이벤트
    let buffTimer = null;
    const btnShare = document.getElementById('btn-share');
    const snsModal = document.getElementById('sns-share-modal');

    // 하단 '공유하기' 버튼 클릭 시 모달 열기 (버프는 아직 적용 안 됨)
    btnShare.addEventListener('click', () => {
        if (btnShare.disabled) return; // 이미 버프 중일 때 제외
        if (snsModal) snsModal.classList.remove('hidden');
    });

    // SNS 개별 공유 버튼 클릭 시 처리
    if (snsModal) {
        const snsBtns = snsModal.querySelectorAll('button[data-sns]');
        const shareData = {
            title: '하린의 MBTI 전쟁!',
            text: '나의 MBTI 진영이 꿀리고 있어! 와서 클릭으로 도와줘!!',
            url: window.location.href // 배포 시 실제 URL
        };

        // 모바일 HTTP 환경 대응: navigator.clipboard가 없으면 textarea 트릭 사용
        const copyToClipboard = async (text) => {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                return new Promise((res, rej) => {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "absolute";
                    textArea.style.left = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy') ? res() : rej();
                    } catch (e) {
                        rej(e);
                    }
                    textArea.remove();
                });
            }
        };

        snsBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const snsType = btn.dataset.sns;
                const encodedUrl = encodeURIComponent(shareData.url);
                const encodedText = encodeURIComponent(shareData.text);
                const encodedTitle = encodeURIComponent(shareData.title);

                let isShared = false;

                try {
                    switch (snsType) {
                        case 'kakao':
                            // 카카오톡은 API Key 없이 웹에서 바로 열기 어려우므로, 
                            // 기기의 기본 공유 창(navigator.share)을 띄워서 카톡을 선택하게 유도
                            if (navigator.share) {
                                await navigator.share(shareData);
                            } else {
                                await copyToClipboard(shareData.url);
                                alert("기기에서 직접 공유를 지원하지 않아 링크가 복사되었습니다!\n카카오톡에 붙여넣기 해주세요.");
                            }
                            isShared = true;
                            break;
                        case 'twitter':
                            window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
                            isShared = true;
                            break;
                        case 'facebook':
                            // 페이스북은 로컬(localhost) URL을 공유하려고 하면 서버가 긁어갈 수 없어 에러가 납니다.
                            // 실제 도메인에 올라가면 정상 작동합니다. (개발 중엔 임시로 구글로 테스트)
                            const fbUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
                                ? encodeURIComponent('https://mbti-harin.web.app')
                                : encodedUrl;
                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${fbUrl}`, '_blank');
                            isShared = true;
                            break;
                        case 'blog':
                            window.open(`https://share.naver.com/web/shareView.nhn?url=${encodedUrl}&title=${encodedTitle}`, '_blank');
                            isShared = true;
                            break;
                        case 'instagram':
                            // 인스타그램은 직접 공유 URL이 제한적이므로 클립보드 복사 유도
                            await copyToClipboard(shareData.url);
                            alert("인스타그램은 웹에서 직접 공유가 지원되지 않아 링크가 복사되었습니다!\n인스타그램 피드나 스토리에 붙여넣기 해주세요 📸");
                            isShared = true;
                            break;
                        case 'link':
                            await copyToClipboard(shareData.url);
                            alert("링크가 복사되었습니다! 친구들에게 공유해보세요 🚀");
                            isShared = true;
                            break;
                    }

                    // 실제로 버튼을 누른 게 확인되면 모달을 닫고 버프 적용!
                    if (isShared) {
                        snsModal.classList.add('hidden');
                        const durationSec = 5 * 60; // 5분
                        activateBuff(durationSec, btnShare);
                        // 새로고침해도 유지되도록 로컬스토리지에 버프 만료 시간 저장
                        localStorage.setItem('mbti_buff_expire', Date.now() + (durationSec * 1000));
                    }
                } catch (error) {
                    console.log('SNS 공유 에러', error);
                    alert("공유를 취소했거나 오류가 발생했습니다.");
                }
            });
        });
    }

    // 버프 복원 (페이지 로드 시)
    const expireTime = localStorage.getItem('mbti_buff_expire');
    if (expireTime && Date.now() < parseInt(expireTime)) {
        const timeLeftSec = Math.floor((parseInt(expireTime) - Date.now()) / 1000);
        activateBuff(timeLeftSec, btnShare);
    } else {
        localStorage.removeItem('mbti_buff_expire');
    }

    function activateBuff(seconds, btnShare) {
        clearInterval(buffTimer);
        window.ClickerAPI.shareBuffMultiplier = 2;
        // 버프 활성화 사운드 (신규 공유 시에만 재생, 복원 시 제외)
        if (seconds > 290 && window.soundManager) window.soundManager.playShareBuff();
        const indicator = document.getElementById('buff-indicator');
        const timerSpan = document.getElementById('buff-timer');
        if (indicator) indicator.style.display = 'block';

        if (btnShare) {
            btnShare.disabled = true;
            btnShare.innerText = "✨ 공유 버프 활성화 중!";
        }

        let timeLeft = seconds;
        buffTimer = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            if (timerSpan) timerSpan.innerText = `${m}:${s}`;

            if (timeLeft <= 0) {
                clearInterval(buffTimer);
                window.ClickerAPI.shareBuffMultiplier = 1;
                if (indicator) indicator.style.display = 'none';
                localStorage.removeItem('mbti_buff_expire');
                if (btnShare) {
                    btnShare.disabled = false;
                    btnShare.innerText = "🚀 친구 초대하고 5분간 [클릭 2배] 받기!";
                }
            }
        }, 1000);
    }
});
