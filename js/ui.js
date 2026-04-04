/**
 * ui.js
 * 화면의 게이지, 점수 텍스트, 이펙트 등 시각 효과 렌더링 담당
 */

const mbtiColors = {
    'E': '#FF5A5F', 'I': '#4A90E2',
    'S': '#F5A623', 'N': '#9013FE',
    'T': '#00B4D8', 'F': '#FB6F92',
    'J': '#2ECC71', 'P': '#F39C12'
};
window.mbtiColors = mbtiColors;

// 압도 상태 추적용 Map (axis별 현재 압도 메시지 저장)
const dominationMap = new Map();

window.UI = {
    updateGauge: (axis, leftScore, rightScore) => {
        const rowDom = document.querySelector(`.mbti-row[data-axis="${axis}"]`);
        if (!rowDom) return;

        // 비율 구하기
        const total = leftScore + rightScore;
        const leftRatio = total === 0 ? 50 : (leftScore / total) * 100;
        const rightRatio = 100 - leftRatio;

        // 퍼센트 텍스트 업데이트
        rowDom.querySelector('.left-score').innerText = `${Math.round(leftRatio)}%`;
        rowDom.querySelector('.right-score').innerText = `${Math.round(rightRatio)}%`;

        // 게이지 UI 업데이트
        const fillDom = rowDom.querySelector('.gauge-fill');
        const leftType = rowDom.querySelector('.btn-left').dataset.type;
        const rightType = rowDom.querySelector('.btn-right').dataset.type;

        fillDom.style.width = `${leftRatio}%`;
        fillDom.style.background = `linear-gradient(90deg, ${mbtiColors[leftType]}, ${mbtiColors[rightType]})`;

        // 극단적일 때 압도 배너 표시
        UI.checkDomination(leftType, rightType, leftRatio, axis);

        // 버튼 하단 누적 클릭 수 뱃지 갱신
        UI.updateBadge(leftType, leftScore);
        UI.updateBadge(rightType, rightScore);
    },

    updateBadge: (type, score) => {
        const badge = document.getElementById(`badge-${type}`);
        if (badge) badge.innerText = score.toLocaleString();
    },

    updateTotalClicks: (state) => {
        let total = 0;
        for (const axis of ['ei', 'sn', 'tf', 'jp']) {
            total += state[axis].left + state[axis].right;
        }
        const totalDom = document.getElementById('total-clicks');
        if (totalDom) totalDom.innerText = total.toLocaleString();
    },

    updateIllustration: (state) => {
        let currentMBTI = '';
        let total = 0;

        const axes = ['ei', 'sn', 'tf', 'jp'];
        axes.forEach(axis => {
            total += state[axis].left + state[axis].right;
        });

        if (total === 0) {
            currentMBTI = 'standard';
        } else {
            const e = state.ei.left >= state.ei.right ? 'E' : 'I';
            const s = state.sn.left >= state.sn.right ? 'S' : 'N';
            const t = state.tf.left >= state.tf.right ? 'T' : 'F';
            const j = state.jp.left >= state.jp.right ? 'J' : 'P';
            currentMBTI = `${e}${s}${t}${j}`;
        }

        // 배경+캐릭터 합성 이미지를 단일 레이어로 표시
        const illLayer = document.getElementById('layer-background');
        if (illLayer) {
            illLayer.style.backgroundImage = `url('assets/MBTI/${currentMBTI}.webp')`;
        }

        const mbtiLabel = document.getElementById('current-mbti-label');
        if (mbtiLabel) {
            mbtiLabel.innerText = currentMBTI === 'standard' ? '????' : currentMBTI;
        }
    },

    updateCombo: (combo, multiplier) => {
        const comboMeter = document.getElementById('combo-meter');
        const comboCount = comboMeter.querySelector('.combo-count');
        const comboBar = comboMeter.querySelector('.combo-bar');
        const comboText = comboMeter.querySelector('.combo-text');

        if (combo > 0) {
            comboMeter.classList.remove('fade-out');
            comboCount.innerText = combo;
            // 바 길이 최댓값 50콤보 계산
            const percent = Math.min((combo / 50) * 100, 100);
            comboBar.style.width = percent + '%';

            if (combo >= 50) {
                // 피버 모드 직관성 활성화
                comboText.innerHTML = `🔥 FEVER (클릭 x${multiplier}) 🔥`;
                comboText.style.color = '#ff4757';
                comboText.style.fontSize = '1.2rem';
                comboBar.style.background = 'linear-gradient(90deg, #ff0844, #ffb199)';
                comboCount.style.color = '#ff4757';
                comboCount.style.textShadow = '0 0 20px #ff4757';
            } else {
                comboText.innerText = 'COMBO';
                comboText.style.color = '#f5a623';
                comboText.style.fontSize = '1rem';
                comboBar.style.background = '#f5a623';
                comboCount.style.color = '#fff';
                comboCount.style.textShadow = '0 0 15px #f5a623, 0 0 30px #f5a623';
            }
        } else {
            comboMeter.classList.add('fade-out');
        }
    },

    updateMVPRanking: (allUsers) => {
        if (!allUsers) return;
        // 전체 탭용: total_clicks 기준 내림차순 정렬
        const sorted = [...allUsers].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0));

        // scoreKey: null이면 total_clicks, 'E'/'I'/... 이면 clicks[scoreKey] 표시
        const renderList = (id, filteredUsers, scoreKey = null) => {
            const list = document.getElementById(`list-${id}`);
            if (!list) return;
            list.innerHTML = '';

            // VIP 후원자 닉네임 목록 로드 (donate_mock_data.authMap)
            let vipNicknames = new Set();
            try {
                const mockData = JSON.parse(localStorage.getItem('donate_mock_data') || '{}');
                if (mockData.authMap) {
                    Object.values(mockData.authMap).forEach(nick => vipNicknames.add(nick));
                }
            } catch(e) {}

            // 전체 탭은 20위, MBTI별 탭은 10위까지 표시
            const limit = (id === 'ALL') ? 20 : 10;
            const topUsers = filteredUsers.slice(0, limit);
            if (topUsers.length === 0) {
                list.innerHTML = `<li><small style="color:#aaa;">아직 기여자가 없습니다.</small></li>`;
                return;
            }

            topUsers.forEach((user, index) => {
                const li = document.createElement('li');
                // 이모지 + 순위 숫자 함께 표시
                let badge;
                if (index === 0) badge = `<span class="rank-badge rank-1">👑 1위</span>`;
                else if (index === 1) badge = `<span class="rank-badge rank-2">🥈 2위</span>`;
                else if (index === 2) badge = `<span class="rank-badge rank-3">🥉 3위</span>`;
                else badge = `<span class="rank-badge">${index + 1}위</span>`;

                const mbtiLabel = user.mbti_type || user.mbtiType || '비공개';
                // scoreKey가 있으면 해당 버튼 클릭 수, 없으면 총 클릭 수
                const score = scoreKey
                    ? ((user.clicks && user.clicks[scoreKey]) || 0)
                    : (user.total_clicks || 0);

                // VIP 뱃지 여부 확인
                const isVip = vipNicknames.has(user.nickname);
                const vipBadgeHtml = isVip
                    ? `<span class="vip-badge">💎 VIP</span>`
                    : '';

                li.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.05);';
                li.innerHTML = `
                    ${badge}
                    <span class="rank-nick" style="cursor:pointer; text-decoration:underline; text-decoration-color:rgba(255,255,255,0.2); ${user.id === localStorage.getItem('mbti_userid') ? 'color:#ff9a9e;font-weight:bold;' : ''}">${user.nickname}${vipBadgeHtml} <span style="font-size:0.75rem; color:#888;">(${mbtiLabel})</span></span>
                    <span class="rank-score">${score.toLocaleString()}</span>
                `;
                
                const nickSpan = li.querySelector('.rank-nick');
                if (nickSpan) {
                    nickSpan.addEventListener('click', () => {
                        if (window.ProfileAPI) {
                            window.ProfileAPI.openUserProfile(user.id, user.nickname, mbtiLabel);
                        }
                    });
                }
                
                list.appendChild(li);
            });
        };

        // 1. 전체 (ALL) - total_clicks 기준
        renderList('ALL', sorted);

        // 2. 각 버튼별 랭킹 (E, I, S, N, T, F, J, P)
        // E탭 = E버튼을 가장 많이 누른 사람 순위 (MBTI 타입 무관)
        const axes = ['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P'];
        axes.forEach(axis => {
            const axisUsers = [...allUsers]
                .filter(u => u.clicks && (u.clicks[axis] || 0) > 0)
                .sort((a, b) => ((b.clicks && b.clicks[axis]) || 0) - ((a.clicks && a.clicks[axis]) || 0));
            renderList(axis, axisUsers, axis); // axis를 scoreKey로 전달
        });

        // 3. 내 기여도(클릭 수) 요약란 업데이트
        const myId = localStorage.getItem('mbti_userid');
        const myNickname = localStorage.getItem('mbti_nickname');
        const myClicksEl = document.getElementById('my-total-clicks');
        const guestHint = document.getElementById('guest-hint');

        if (myId && myNickname && myNickname !== 'Guest') {
            // 등록 유저: 기여도 숫자 표시
            const me = allUsers.find(u => u.id === myId);
            if (myClicksEl) {
                myClicksEl.style.display = '';
                myClicksEl.innerText = me ? (me.total_clicks || 0).toLocaleString() : '0';
            }
            if (guestHint) guestHint.style.display = 'none';
        } else {
            // 게스트: 숫자 숨기고 등록 유도 힌트 표시
            if (myClicksEl) myClicksEl.style.display = 'none';
            if (guestHint) {
                guestHint.style.display = 'inline';
                // 클릭 시 닉네임 모달 재오픈 (중복 등록 방지)
                guestHint.onclick = () => {
                    const modal = document.getElementById('nickname-modal');
                    if (modal) modal.classList.remove('hidden');
                };
            }
        }
    },


    showClickFeedback: (btnDom, typeEmoji) => {
        // 버튼 팝 애니메이션
        btnDom.classList.remove('pop-anim');
        void btnDom.offsetWidth; // trigger reflow
        btnDom.classList.add('pop-anim');

        // 파티클(이모지) 효과
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.innerText = typeEmoji;

        // 버튼 위치 기준으로 파티클 위치 세팅 (스크롤 위치 보정)
        const rect = btnDom.getBoundingClientRect();
        const randX = (Math.random() - 0.5) * 30; // 약간 범위 랜덤
        particle.style.left = `${rect.left + window.scrollX + rect.width / 2 + randX - 10}px`;
        particle.style.top = `${rect.top + window.scrollY - 10}px`;

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 1000);
    },

    checkDomination: (leftType, rightType, ratio, axis) => {
        // axis별 압도 여부 갱신
        if (ratio >= 80) {
            dominationMap.set(axis, `🔥 ${leftType} 진영이 압도 중입니다!`);
        } else if (ratio <= 20) {
            dominationMap.set(axis, `🔥 ${rightType} 진영이 압도 중입니다!`);
        } else {
            dominationMap.set(axis, null); // 압도 아님
        }

        // 압도 중인 메시지만 필터링
        const activeMessages = [...dominationMap.values()].filter(Boolean);

        const banner = document.getElementById('status-banner');
        const text = document.getElementById('banner-text');

        if (activeMessages.length > 0) {
            text.innerHTML = activeMessages.join('<br>'); // 여러 줄 표시
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    }
};
