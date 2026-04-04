/**
 * makgora.js — 턴제 심리전 막고라 (v2)
 * 룰: HP10, 기본공격2, 최대10턴, 홀=3선택/짝=4선택
 * 직진/간파/축적/통제 상호작용 + 5턴~데미지+1 + 서든데스
 */

window.MakgoraAPI = (() => {
    // ── 상수 ──────────────────────────────
    const MAX_TURNS   = 10;
    const INIT_HP     = 10;
    const BASE_DMG    = 2;
    const ACCEL_TURN  = 5;   // 이 턴부터 데미지 +1
    const TURN_TIMEOUT = 8;  // 초 (서든데스 시 타임아웃)
    const SUDDEN_TIMEOUT = 5;

    // ── 상태 ──────────────────────────────
    let state = {
        active: false,
        turn: 1,
        isSudden: false,
        myHP: INIT_HP, rivalHP: INIT_HP,
        myBuffed: false,      // 축적 사용 여부
        rivalBuffed: false,
        myBan: null,          // 내가 통제로 걸어놓은 상대 행동 금지
        rivalBan: null,       // 상대가 통제로 건 내 행동 금지
        myAction: null,       // 현재 턴 선택
        myBanTarget: null,    // 통제 시 봉쇄 대상
        rivalName: '상대방',
        isMock: true,
        roomRef: null,
        pendingRivalName: null,
        timer: null,
        timerLeft: 0,
    };

    // ── DOM refs ──────────────────────────
    let overlay, resultEl, resultIcon, resultTitle, resultDesc, finishBtn;
    let myNameEl, rivalNameEl, myHpEl, rivalHpEl, myHpBar, rivalHpBar;
    let turnLabel, maxTurnsEl, statusBox, logBox, buffLabel, banLabel, timerEl;
    let actionBtns, banSelect, suddenLabel;

    // ── 매칭 큐 상태 ──────────────────────
    let matchQueueRef = null;
    let matchQueueCountdown = null;
    let matchQueueTimer = null;
    let inviteModal, inviteText, acceptBtn, declineBtn;
    
    // ── 봇 매칭 이름 ──────────────────────
    const BOT_NAMES = ['알파고', '딥블루', '심심이', '이루다', 'ChatGPT', 'Antigravity'];

    // ── 유틸 ──────────────────────────────
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    function $(id) { return document.getElementById(id); }
    function actionName(a) {
        return { charge:'돌진(E)', parry:'간파(N)', store:'축적(I)' }[a] || a;
    }
    function actionEmoji(a) {
        return { charge:'🟥', parry:'🟦', store:'🟨', control:'🟧' }[a] || '';
    }

    // ── DOM 캐시 ──────────────────────────
    function cacheDOM() {
        overlay      = $('makgora-overlay');
        resultEl     = $('makgora-result');
        resultIcon   = $('makgora-result-icon');
        resultTitle  = $('makgora-result-title');
        resultDesc   = $('makgora-result-desc');
        finishBtn    = $('btn-makgora-finish');
        myNameEl     = $('makgora-my-name');
        rivalNameEl  = $('makgora-rival-name');
        myHpEl       = $('makgora-my-hp');
        rivalHpEl    = $('makgora-rival-hp');
        myHpBar      = $('makgora-my-hp-bar');
        rivalHpBar   = $('makgora-rival-hp-bar');
        turnLabel    = $('makgora-turn-label');
        maxTurnsEl   = $('makgora-max-turns');
        statusBox    = $('makgora-status-box');
        logBox       = $('makgora-log');
        buffLabel    = $('makgora-buff-label');
        banLabel     = $('makgora-ban-label');
        timerEl      = $('makgora-timer');
        actionBtns   = $('makgora-action-btns');
        banSelect    = $('makgora-ban-select');
        suddenLabel  = $('makgora-sudden-label');
        inviteModal  = $('makgora-invite-modal');
        inviteText   = $('makgora-invite-text');
        acceptBtn    = $('btn-makgora-accept');
        declineBtn   = $('btn-makgora-decline');
    }

    // ── 이벤트 바인딩 ─────────────────────
    function bindEvents() {
        // 액션 버튼
        document.querySelectorAll('.mg-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (state.active && !btn.disabled && window.soundManager) window.soundManager.playHover();
            });
            btn.addEventListener('click', () => {
                if (!state.active) return;
                if (window.soundManager) window.soundManager.playClick();
                const action = btn.dataset.action;
                submitAction(action);
            });
        });

        if (finishBtn) finishBtn.addEventListener('click', closeOverlay);
        if (acceptBtn) acceptBtn.addEventListener('click', acceptInvite);
        if (declineBtn) declineBtn.addEventListener('click', () => {
            if (inviteModal) inviteModal.classList.add('hidden');
        });
        
        const surrenderBtn = $('btn-makgora-surrender');
        if (surrenderBtn) {
            surrenderBtn.addEventListener('click', () => {
                if (!state.active) return;
                if (confirm('정말 기권하시겠습니까? 기권 시 판정패로 기록됩니다.')) {
                    state.myHP = 0; // Forced loss
                    state.forfeit = true;
                    endBattle();
                }
            });
        }
    }

    // ── HP 바 업데이트 ────────────────────
    function updateHpUI() {
        if (myHpEl)   myHpEl.textContent   = Math.max(0, state.myHP);
        if (rivalHpEl) rivalHpEl.textContent = Math.max(0, state.rivalHP);
        const myPct    = Math.max(0, (state.myHP   / INIT_HP) * 100);
        const rivalPct = Math.max(0, (state.rivalHP / INIT_HP) * 100);
        if (myHpBar)    myHpBar.style.width    = myPct    + '%';
        if (rivalHpBar) rivalHpBar.style.width = rivalPct + '%';
        if (buffLabel) buffLabel.textContent = state.myBuffed ? '✨ 축적 중' : '없음';
    }

    // ── 화면 이펙트 (흔들림 및 플로팅 데미지) ─────
    function shakeScreen() {
        const wrap = $('makgora-hp-container') || overlay;
        wrap.classList.remove('shake');
        void wrap.offsetWidth;
        wrap.classList.add('shake');
        setTimeout(() => wrap.classList.remove('shake'), 450);
    }

    function showFloatingDamage(anchorId, amount) {
        if (!amount || amount <= 0) return;
        const anchor = $(anchorId);
        if (!anchor) return;
        const div = document.createElement('div');
        div.className = 'floating-damage';
        div.textContent = `-${amount}`;
        anchor.appendChild(div);
        setTimeout(() => div.remove(), 1200);
    }

    // ── 행동 버튼 상태 갱신 ───────────────
    function refreshActionButtons() {
        const h = state.myActionHistory || [];
        const banAct = (h.length >= 2 && h[h.length-1] === h[h.length-2]) ? h[h.length-1] : null;

        document.querySelectorAll('.mg-btn').forEach(btn => {
            const act = btn.dataset.action;
            btn.disabled = false;
            
            // 상태 켜져있지 않으면 무조건 끄기
            if (!state.active) btn.disabled = true;
            
            // 3연속 같은 카드 선택 방지
            if (act === banAct) {
                btn.disabled = true;
                btn.title = '3번 연속 같은 행동은 불가능합니다!';
            } else {
                btn.title = '';
            }
        });

        // banSelect 숨기기
        if (banSelect) banSelect.style.display = 'none';
        if (actionBtns) actionBtns.style.display = 'grid';
    }

    // ── 타이머 ────────────────────────────
    function startTurnTimer(seconds, onTimeout) {
        clearInterval(state.timer);
        state.timerLeft = seconds;
        if (timerEl) timerEl.textContent = seconds;
        state.timer = setInterval(() => {
            state.timerLeft--;
            if (timerEl) {
                timerEl.textContent = state.timerLeft;
                timerEl.style.color = state.timerLeft <= 3 ? '#ff6b6b' : '#f6c90e';
            }
            if (state.timerLeft <= 0) {
                clearInterval(state.timer);
                onTimeout();
            }
        }, 1000);
    }

    // ── 대결 시작 ─────────────────────────
    async function startBattle(rivalName, isMock = true, rivalId = null, isBot = false) {
        state = {
            ...state,
            active: false,
            turn: 1, isSudden: false,
            myHP: INIT_HP, rivalHP: INIT_HP,
            myBuffed: false, rivalBuffed: false,
            myAction: null,
            myActionHistory: [], rivalActionHistory: [],
            rivalName: rivalName || '상대방',
            rivalId: rivalId,
            isMock,
            isBot,
        };

        const myNick = localStorage.getItem('mbti_nickname') || '나';
        if (myNameEl)   myNameEl.textContent   = myNick;
        if (rivalNameEl) rivalNameEl.textContent = state.rivalName;
        if (maxTurnsEl)  maxTurnsEl.textContent  = MAX_TURNS;
        if (suddenLabel) suddenLabel.style.display = 'none';
        if (resultEl)    resultEl.style.display = 'none';
        if (logBox)      logBox.textContent = '게임 시작! 첫 번째 턴입니다.';

        updateHpUI();
        overlay.style.display = 'flex';
        setTimeout(() => overlay.style.opacity = '1', 10); // fade-in
        setStatus('⏳ 준비 중...');
        disableAllActions();

        // [신규] 게임 시작 스크린 표시 (2초 지연)
        const startScreen = $('makgora-start-screen');
        if (startScreen) {
            const snMy = $('mg-start-my-name');
            const snRi = $('mg-start-rival-name');
            const rivalDisplay = state.rivalName + (isMock ? ' (봇)' : '');
            if (snMy) snMy.textContent = myNick;
            if (snRi) snRi.textContent = rivalDisplay;
            startScreen.style.display = 'flex';
            if (window.soundManager) window.soundManager.playGameStart();
            await sleep(2200);
            startScreen.style.display = 'none';
        }

        // 카운트다운 3-2-1
        let cd = 3;
        if (timerEl) { timerEl.textContent = cd; timerEl.style.color = '#fbc2eb'; }
        if (window.soundManager) window.soundManager.playClick();
        const cdInt = setInterval(() => {
            cd--;
            if (cd <= 0) {
                clearInterval(cdInt);
                if (timerEl) timerEl.style.color = '#f6c90e';
                state.active = true;
                if (window.soundManager) window.soundManager.playAchievement();
                beginTurn();
            } else {
                if (window.soundManager) window.soundManager.playClick();
                if (timerEl) timerEl.textContent = cd;
            }
        }, 800);
    }

    // ── 턴 시작 ───────────────────────────
    function beginTurn() {
        if (turnLabel) turnLabel.textContent = state.turn;
        refreshActionButtons();

        // 5턴 가속 돌입 알림
        if (state.turn === ACCEL_TURN && !state.isSudden) {
            setStatus(`⚡ ${state.turn}턴! 이제부터 기본 공격력 +1 증가!`);
            if (logBox) logBox.innerHTML = '<div style="color:#f6c90e; font-weight:bold;">⚡ 후반 가속 돌입! 모든 기본 데미지 +1 증가!</div>';
        } else {
            setStatus(`🎮 턴 ${state.turn} — 행동을 선택하세요!`);
        }

        const timeout = state.isSudden ? SUDDEN_TIMEOUT : TURN_TIMEOUT;
        startTurnTimer(timeout, () => {
            // 타임아웃 = 자동 직진
            if (!state.myAction) {
                submitAction('charge', null);
            }
        });
    }

    // ── 행동 제출 ─────────────────────────
    async function submitAction(action) {
        if (!state.active || state.myAction) return;
        clearInterval(state.timer);

        state.myAction = action;

        disableAllActions();
        setStatus(`✅ "${actionName(action)}" 선택 완료! 상대 응답 대기 중...`);

        if (state.isMock) {
            // 봇에게 선택 지연 시간 (고민하는 느낌 추가)
            const botRes = botChoose();
            await sleep(800 + Math.random() * 1200);
            await resolveTurn(action, botRes);
        }
        // Firebase 실시간 모드는 firebase 연동 필요 (현재 Mock 위주)
    }

    // ── 봇 AI ─────────────────────────────
    function botChoose() {
        let choices = ['charge', 'parry', 'store'];
        
        // 3연속 제한 적용
        const h = state.rivalActionHistory || [];
        if (h.length >= 2 && h[h.length-1] === h[h.length-2]) {
            choices = choices.filter(c => c !== h[h.length-1]);
        }

        // 간단 전략: HP 낮으면 공격 편중
        if (state.rivalHP <= 4 && choices.includes('charge')) {
            choices = choices.map(c => c === 'charge' ? ['charge','charge'] : [c]).flat();
        }
        
        const pick = choices[Math.floor(Math.random() * choices.length)];
        return { action: pick };
    }

    // ── 턴 결산 (애니메이션 분리) ─────────────────
    async function resolveTurn(myAct, botRes) {
        const rivalAct = botRes.action;

        // [Phase 1: 결과 공개 연출]
        const clashText = $('makgora-clash-text');
        if (clashText) {
            clashText.style.display = 'block';
            clashText.classList.remove('clash-pop');
            void clashText.offsetWidth; // reflow
            clashText.classList.add('clash-pop');
            clashText.innerHTML = `
                <span style="color:#43e97b;">${actionName(myAct)} ${actionEmoji(myAct)}</span>
                <span style="font-size:1.5rem; color:#f6c90e; font-style:italic; margin:0 15px;">VS</span>
                <span style="color:#ff6b6b;">${actionEmoji(rivalAct)} ${actionName(rivalAct)}</span>
            `;
        }
        setStatus('⚔️ 서로의 선택이 공개되었습니다!');
        
        // 공개 상태 유지를 위한 1.8초 딜레이
        await sleep(1800);
        if (clashText) clashText.style.display = 'none';

        // 히스토리 추가
        if(!state.myActionHistory) state.myActionHistory = [];
        if(!state.rivalActionHistory) state.rivalActionHistory = [];
        state.myActionHistory.push(myAct);
        state.rivalActionHistory.push(rivalAct);

        // 데미지 계산용 기본값 (후반 가속 적용)
        const accel = state.turn >= ACCEL_TURN ? 1 : 0;
        const suddenMult = state.isSudden ? 2 : 1;
        let baseDmg   = (BASE_DMG + accel) * suddenMult;
        let parryDmg  = Math.ceil(baseDmg * 1.5);
        let storedDmg = baseDmg * 2;

        let myDmgDealt   = 0; // 내가 받는 데미지
        let rivalDmgDealt = 0; // 상대가 받는 데미지
        let logs = [];

        let willMyBuff = (myAct === 'store');
        let willRivalBuff = (rivalAct === 'store');

        // ── 상호작용 계산 ─────────────────────
        // 양쪽 직진
        if (myAct === 'charge' && rivalAct === 'charge') {
            const d = state.myBuffed ? storedDmg : baseDmg;
            const rd = state.rivalBuffed ? storedDmg : baseDmg;
            myDmgDealt   = rd; 
            rivalDmgDealt = d; 
            logs.push(`⚔️ 직진 vs 직진 — 서로 ${d}/${rd} 데미지`);
        }
        // 내 직진 vs 상대 간파
        else if (myAct === 'charge' && rivalAct === 'parry') {
            // 버프 있어도 간파 반사는 기본 데미지 기준 (버프가 간파에 역이용되지 않음)
            const baseAtk = baseDmg;
            const riMult = state.rivalBuffed ? 2 : 1;
            const reflected = Math.ceil(baseAtk * 1.5) * riMult;
            myDmgDealt = reflected;
            if (state.myBuffed) {
                logs.push(`🟦 상대 간파! 축적한 힘이 흡수됩니다. ${reflected} 반사 데미지`);
            } else {
                logs.push(`🟦 상대 간파 성공! ${reflected} 통렬한 반사 데미지를 받았습니다`);
            }
        }
        // 내 간파 vs 상대 직진
        else if (myAct === 'parry' && rivalAct === 'charge') {
            const rivalAtk = state.rivalBuffed ? storedDmg : baseDmg;
            const riMult = state.myBuffed ? 2 : 1;
            const reflected = Math.ceil(rivalAtk * 1.5) * riMult;
            rivalDmgDealt = reflected;
            logs.push(`🟦 간파 성공! ${reflected} 통렬한 반사 데미지를 돌려줍니다`);
        }
        // 내 직진 vs 상대 축적
        else if (myAct === 'charge' && rivalAct === 'store') {
            const d = state.myBuffed ? storedDmg : baseDmg;
            rivalDmgDealt = d;
            willRivalBuff = false;
            logs.push(`🟥 폭풍 돌진으로 상대 축적 파괴! ${d} 데미지`);
        }
        // 내 축적 vs 상대 직진
        else if (myAct === 'store' && rivalAct === 'charge') {
            const d = state.rivalBuffed ? storedDmg : baseDmg;
            myDmgDealt = d;
            willMyBuff = false;
            logs.push(`🟥 상대 돌진에 축적 파괴! ${d} 데미지를 받았습니다`);
        }
        // 간파 vs 간파
        else if (myAct === 'parry' && rivalAct === 'parry') {
            logs.push(`🟦 간파 vs 간파 — 서로 경계`);
        }
        // 간파 vs 축적
        else if (myAct === 'parry' && rivalAct === 'store') {
            logs.push(`💨 간파와 기 모으기가 엇갈렸습니다`);
        }
        else if (myAct === 'store' && rivalAct === 'parry') {
            logs.push(`💨 내 기 모으기와 상대 간파가 엇갈렸습니다`);
        }
        // 축적 vs 축적
        else if (myAct === 'store' && rivalAct === 'store') {
            logs.push(`🟨 서로 강력한 일격을 위해 기운을 모읍니다`);
        }

        // 축적 소비 처리
        state.myBuffed = willMyBuff;
        state.rivalBuffed = willRivalBuff;

        // [Phase 2: 이펙트와 함께 데미지 적용]
        state.myHP   -= myDmgDealt;
        state.rivalHP -= rivalDmgDealt;

        // 흔들림 및 플로팅 콜
        if (myDmgDealt > 0) showFloatingDamage('mg-dmg-left', myDmgDealt);
        if (rivalDmgDealt > 0) showFloatingDamage('mg-dmg-right', rivalDmgDealt);
        if (myDmgDealt > 0 || rivalDmgDealt > 0) {
            if (window.soundManager) window.soundManager.playDamage();
        }
        if (myDmgDealt >= 3 || rivalDmgDealt >= 3) {
            shakeScreen();
        }
        if (willMyBuff || willRivalBuff) {
            if (window.soundManager) window.soundManager.playBuff();
        }

        // 판정 결과 로그 출력 및 체력 갱신
        updateHpUI();
        if (logBox) logBox.innerHTML = logs.map(l => `<div>${l}</div>`).join('');

        // [Phase 3: 결과 관전 시간 부여 후 종료 / 다음 턴 전환]
        await sleep(1500); // 1.5초간 로그 확인하도록 대기

        if (state.myHP <= 0 || state.rivalHP <= 0) {
            endBattle();
            return;
        }
        if (state.turn >= MAX_TURNS && !state.isSudden) {
            if (state.myHP !== state.rivalHP) { endBattle(); return; }
            enterSuddenDeath();
            return;
        }

        // 다음 턴 세팅
        state.myAction = null;
        state.myBanTarget = null;
        state.turn++;
        if (highHpMatch()) endBattle(); 
        else beginTurn();
    }

    function highHpMatch() {
        return state.isSudden && state.turn > MAX_TURNS + 10;
    }

    // ── 서든데스 ──────────────────────────
    function enterSuddenDeath() {
        state.isSudden = true;
        if (suddenLabel) suddenLabel.style.display = '';
        if (logBox) logBox.innerHTML = '<div>🔥 서든데스! 데미지 2배! 빠르게 결판내세요!</div>';
        setStatus('💥 서든데스 돌입!');
        state.myAction = null;
        state.turn++;
        setTimeout(beginTurn, 1200);
    }

    // ── 게임 종료 ─────────────────────────
    function endBattle() {
        state.active = false;
        clearInterval(state.timer);

        const myNick = localStorage.getItem('mbti_nickname') || '나';
        let won, draw, icon, title, desc;

        if (state.myHP <= 0 && state.rivalHP <= 0) {
            draw = true;
        } else if (state.myHP > state.rivalHP) {
            won = true;
        } else if (state.myHP < state.rivalHP) {
            won = false;
        } else {
            draw = true;
        }

        if (draw) {
            icon  = '🤝'; title = '무승부!';
            desc  = `${state.myHP} vs ${state.rivalHP} HP — 막상막하였습니다!`;
            if (window.soundManager) window.soundManager.playClick();
        } else if (won) {
            icon  = '🏆'; title = '승리!';
            desc  = `HP ${state.myHP} 남아 — ${state.rivalName}을/를 꺾었습니다!`;
            if (window.soundManager) window.soundManager.playVictory();
        } else {
            icon  = '💀'; title = '패배...';
            desc  = `HP ${state.myHP} 남아 — ${state.rivalName}에게 졌습니다.`;
            if (window.soundManager) window.soundManager.playDefeat();
        }

        if (resultIcon)  resultIcon.textContent  = icon;
        if (resultTitle) resultTitle.textContent = title;
        if (resultDesc)  resultDesc.textContent  = desc;
        if (resultEl)    resultEl.style.display  = 'flex';

        // Firebase 막고라 랭킹 업데이트
        saveMakgoraResult(won, draw);
    }

    // ── 막고라 랭킹 저장 ──────────────────
    function saveMakgoraResult(won, draw) {
        const userId = localStorage.getItem('mbti_userid');
        if (!userId || userId.startsWith('guest_')) return;
        const db = window.firebase?.apps?.length ? window.firebase.database() : null;
        if (!db) return;
        const ref = db.ref(`makgoraStats/${userId}`);
        ref.once('value', snap => {
            const prev = snap.val() || { wins:0, losses:0, draws:0 };
            ref.set({
                wins:   prev.wins   + (won  ? 1 : 0),
                losses: prev.losses + (!won && !draw ? 1 : 0),
                draws:  prev.draws  + (draw ? 1 : 0),
                nickname: localStorage.getItem('mbti_nickname') || '익명',
                mbti:     localStorage.getItem('mbti_type')     || '',
            });
        });

        // 상대 전적 업데이트 (Head To Head)
        const rivalId = state.rivalId;
        if (rivalId && !state.isBot) {
            const h2hRef = db.ref(`HeadToHead/${userId}/${rivalId}`);
            h2hRef.once('value', snap => {
                const prev = snap.val() || { wins:0, losses:0, draws:0 };
                h2hRef.set({
                    wins: prev.wins + (won ? 1 : 0),
                    losses: prev.losses + (!won && !draw ? 1 : 0),
                    draws: prev.draws + (draw ? 1 : 0)
                });
            });
        }

        // 최근 10판 대전 기록 저장
        const result = won ? 'win' : draw ? 'draw' : 'loss';
        const winnerHP = won ? Math.max(state.myHP, state.rivalHP) : (draw ? state.myHP : state.rivalHP);
        const historyRef = db.ref(`makgoraHistory/${userId}`);
        historyRef.push({
            rivalId:    state.rivalId   || null,
            rivalName:  state.rivalName || '상대방',
            isBot:      state.isBot     || false,
            result:     result,
            winnerHP:   winnerHP,
            forfeit:    !!state.forfeit,
            timestamp:  Date.now()
        }).then(() => {
            // 최신 10개만 유지
            historyRef.once('value', allSnap => {
                if (allSnap.numChildren() > 10) {
                    let oldest = null;
                    allSnap.forEach(child => {
                        if (!oldest || child.val().timestamp < oldest.val().timestamp) oldest = child;
                    });
                    if (oldest) oldest.ref.remove();
                }
            });
        });
    }

    // ── 유틸 함수들 ───────────────────────
    function setStatus(msg) {
        if (statusBox) statusBox.textContent = msg;
    }

    function disableAllActions() {
        document.querySelectorAll('.mg-btn').forEach(b => b.disabled = true);
    }

    function closeOverlay() {
        if (overlay) overlay.style.display = 'none';
        state.active = false;
        clearInterval(state.timer);
        if (state.roomRef) { state.roomRef.off(); state.roomRef = null; }
    }

    function acceptInvite() {
        if (inviteModal) inviteModal.classList.add('hidden');
        startBattle(state.pendingRivalName, false);
    }

    // ── Public API ────────────────────────
    return {
        init() {
            cacheDOM();
            bindEvents();
            this.listenForInvites();
        },

        challenge(rivalId, rivalName) {
            const myId = localStorage.getItem('mbti_userid');
            if (!myId || myId === rivalId) {
                alert('자기 자신에게는 막고라를 신청할 수 없습니다!');
                return;
            }
            if (!rivalId || rivalId.startsWith('dummy_')) {
                startBattle(rivalName, true, rivalId, true);
                return;
            }
            const db = window.firebase?.apps?.length ? window.firebase.database() : null;
            if (!db) {
                alert('Firebase 미연결 상태입니다. 봇과 연습전을 시작합니다!');
                startBattle(rivalName, true, rivalId, true);
                return;
            }
            db.ref(`MakgoraInvites/${rivalId}`).set({
                fromId:   myId,
                fromName: localStorage.getItem('mbti_nickname') || '익명',
                timestamp: Date.now()
            }).then(() => {
                alert(`${rivalName}님께 막고라를 신청했습니다! 수락을 기다리세요.`);
            });
        },

        listenForInvites() {
            const myId = localStorage.getItem('mbti_userid');
            if (!myId) return;
            const db = window.firebase?.apps?.length ? window.firebase.database() : null;
            if (!db) return;
            db.ref(`MakgoraInvites/${myId}`).on('value', snap => {
                if (!snap.exists()) return;
                const data = snap.val();
                if (Date.now() - data.timestamp > 15000) return;
                state.pendingRivalName = data.fromName;
                if (inviteText) inviteText.textContent = `${data.fromName}님이 막고라를 신청했습니다!`;
                if (inviteModal) inviteModal.classList.remove('hidden');
                snap.ref.remove();
            });
        },

        // 막고라 랭킹 불러오기 (외부에서 호출)
        async loadMakgoraRanking() {
            const db = window.firebase?.apps?.length ? window.firebase.database() : null;
            if (!db) return [];
            const snap = await db.ref('makgoraStats').orderByChild('wins').limitToLast(30).once('value');
            if (!snap.exists()) return [];
            const list = [];
            snap.forEach(child => list.unshift({ id: child.key, ...child.val() }));
            return list;
        },

        // 인게임 상대 정보 반환 (프로필 클릭용)
        getRivalInfo() {
            if (!state.active) return null;
            return { id: state.rivalId || null, name: state.rivalName || '상대방' };
        },

        // 막고라 랜덤 매칭큐 (14~16초 타임아웃 → 봇)
        startMatchQueue() {
            const myId = localStorage.getItem('mbti_userid');
            if (!myId || myId.startsWith('guest_')) {
                alert('매칭은 회원 전용 기능입니다. 닉네임을 설정해주세요!');
                return;
            }

            const db = window.firebase?.apps?.length ? window.firebase.database() : null;
            const btn = document.getElementById('btn-random-makgora');
            const banner = document.getElementById('makgora-queue-banner');
            const timerSpan = document.getElementById('makgora-queue-timer');

            // 큐 취소 상태라면 취소
            if (matchQueueRef) {
                this.cancelMatchQueue();
                return;
            }

            let timeElapsed = 0;
            const randomTarget = Math.floor(Math.random() * 3) + 14; // 14, 15, 16 중 하나

            if (btn) {
                btn.innerText = `⚔️ 매칭 중...`;
                btn.style.background = 'linear-gradient(135deg, #636e72, #b2bec3)';
            }
            if (banner && timerSpan) {
                timerSpan.innerText = `0초`;
                banner.style.transform = 'translateY(0)'; // 내려오게 애니메이션
                banner.style.opacity = '1';
                banner.style.pointerEvents = 'auto';
            }

            if (db) {
                // Firebase 큐에 등록
                matchQueueRef = db.ref(`MakgoraQueue/${myId}`);
                matchQueueRef.set({
                    nickname: localStorage.getItem('mbti_nickname') || '익명',
                    mbti: localStorage.getItem('mbti_type') || '',
                    timestamp: Date.now()
                });

                // 큐에 누군가 추가될 때마다 감지
                db.ref('MakgoraQueue').on('value', snap => {
                    if (!matchQueueRef) return; // 내가 큐를 취소했거나 매칭 완료된 상태면 무시
                    
                    let rival = null;
                    snap.forEach(child => {
                        if (child.key !== myId && !rival) {
                            rival = { id: child.key, ...child.val() };
                        }
                    });

                    if (rival) {
                        // 상대 찾음
                        // 내 큐 정리
                        matchQueueRef.remove();
                        matchQueueRef = null;
                        db.ref('MakgoraQueue').off('value'); // 리스너 해제

                        clearInterval(matchQueueCountdown);
                        
                        if (btn) {
                            btn.innerText = '⚔️ 1vs1 매칭';
                            btn.style.background = 'linear-gradient(135deg, #ff0844, #ffb199)';
                        }
                        if (banner) {
                            banner.style.transform = 'translateY(-150%)'; // 배너 올리기
                            banner.style.opacity = '0';
                            banner.style.pointerEvents = 'none';
                        }
                        
                        // ※ 실제로는 서로가 동시에 remove를 시도할 수 있지만 
                        // Firebase 특성상 먼저 실행된 클라이언트가 우선 처리되며,
                        // 임의로 상대를 rival로 지정하고 Battle에 진입합니다.
                        startBattle(rival.nickname || '상대방', false, rival.id, false);
                    }
                });
            }

            // 카운트업 타이머 및 봇 매칭 로직
            matchQueueCountdown = setInterval(() => {
                timeElapsed++;
                if (timerSpan) timerSpan.innerText = `${timeElapsed}초`;
                
                // 타겟 시간에 도달하면 봇과 매칭
                if (timeElapsed >= randomTarget) {
                    clearInterval(matchQueueCountdown);
                    if (matchQueueRef) {
                        if (db) {
                            matchQueueRef.remove();
                            db.ref('MakgoraQueue').off('value');
                        }
                        matchQueueRef = null;
                    }
                    if (btn) {
                        btn.innerText = '⚔️ 1vs1 매칭';
                        btn.style.background = 'linear-gradient(135deg, #ff0844, #ffb199)';
                    }
                    if (banner) {
                        banner.style.transform = 'translateY(-150%)';
                        banner.style.opacity = '0';
                        banner.style.pointerEvents = 'none';
                    }
                    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
                    startBattle(botName, true, null, true);
                }
            }, 1000);
        },

        cancelMatchQueue() {
            const db = window.firebase?.apps?.length ? window.firebase.database() : null;
            const myId = localStorage.getItem('mbti_userid');
            if (matchQueueRef) {
                if (db && myId) {
                    db.ref(`MakgoraQueue/${myId}`).remove();
                    db.ref('MakgoraQueue').off('value');
                }
                matchQueueRef = null;
            }
            clearInterval(matchQueueCountdown);
            const btn = document.getElementById('btn-random-makgora');
            const banner = document.getElementById('makgora-queue-banner');
            if (btn) {
                btn.innerText = '⚔️ 1vs1 매칭';
                btn.style.background = 'linear-gradient(135deg, #ff0844, #ffb199)';
            }
            if (banner) {
                banner.style.transform = 'translateY(-150%)';
                banner.style.opacity = '0';
                banner.style.pointerEvents = 'none';
            }
        }
    };
})();

// 막고라 배너 취소 버튼 등록
document.addEventListener('DOMContentLoaded', () => {
    const cancelBtn = document.getElementById('btn-cancel-makgora-queue');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (window.MakgoraAPI) window.MakgoraAPI.cancelMatchQueue();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window.MakgoraAPI.init();
});
