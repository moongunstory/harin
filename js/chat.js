/**
 * chat.js
 * 실시간 채팅(글로벌, 1:1 매칭) UI 및 로직 처리
 */

window.ChatUI = {
    // 상태 변수
    userId: null,
    nickname: null,
    mbtiType: null,
    currentRoomId: null,
    matchStatus: 'idle', // idle, waiting, matched
    listeners: {
        global: null,
        status: null,
        privateMsgs: null,
        privateInfo: null
    },

    init: function() {
        this.cacheDOM();
        this.bindEvents();
        this.checkAuthStatus();
    },

    cacheDOM: function() {
        // 사이드바 및 모바일 토글
        this.chatSidebar = document.getElementById('chat-sidebar');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.closeBtn = document.getElementById('chat-close-btn');

        // 권한 분기용 오버레이
        this.guestOverlay = document.getElementById('chat-guest-overlay');
        this.btnOpenNickname = document.getElementById('btn-open-nickname-chat');

        // 탭
        this.tabs = document.querySelectorAll('.chat-tab');
        this.views = document.querySelectorAll('.chat-view');

        // 글로벌 채팅
        this.globalMsgList = document.getElementById('global-msg-list');
        this.globalInput = document.getElementById('global-msg-input');
        this.globalSendBtn = document.getElementById('global-msg-send');

        // 1:1 매칭
        this.matchStatusArea = document.getElementById('match-status-area');
        this.matchChatArea = document.getElementById('match-chat-area');
        this.matchStatusText = document.getElementById('match-status-text');
        this.btnStartMatch = document.getElementById('btn-start-match');
        this.btnLeaveMatch = document.getElementById('btn-leave-match');
        this.matchPartnerName = document.getElementById('match-partner-name');
        this.matchMsgList = document.getElementById('match-msg-list');
        this.matchInput = document.getElementById('match-msg-input');
        this.matchSendBtn = document.getElementById('match-msg-send');
    },

    bindEvents: function() {
        // 모바일 토글
        this.toggleBtn.addEventListener('click', () => {
            this.chatSidebar.classList.add('open');
            this.toggleBtn.style.display = 'none';
        });

        this.closeBtn.addEventListener('click', () => {
            this.chatSidebar.classList.remove('open');
            this.toggleBtn.style.display = 'block';
        });

        // 게스트 인증 유도 버튼
        this.btnOpenNickname.addEventListener('click', () => {
            const modal = document.getElementById('nickname-modal');
            if(modal) modal.classList.remove('hidden');
        });

        // 탭 전환
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab);
            });
        });

        // 글로벌 채팅 전송
        this.globalSendBtn.addEventListener('click', () => this.sendGlobalMsg());
        this.globalInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') this.sendGlobalMsg();
        });

        // 1:1 매칭 제어
        this.btnStartMatch.addEventListener('click', () => this.toggleMatchQueue());
        this.btnLeaveMatch.addEventListener('click', () => this.leavePrivateMatch());

        // 1:1 채팅 전송
        this.matchSendBtn.addEventListener('click', () => this.sendPrivateMsg());
        this.matchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') this.sendPrivateMsg();
        });

        // DM 전송
        const dmSendBtn = document.getElementById('dm-msg-send');
        const dmInput = document.getElementById('dm-msg-input');
        const dmBack = document.getElementById('btn-dm-back');
        if(dmSendBtn) dmSendBtn.addEventListener('click', () => this.sendDM());
        if(dmInput) dmInput.addEventListener('keypress', (e) => { if(e.key==='Enter') this.sendDM(); });
        if(dmBack) dmBack.addEventListener('click', () => {
            document.getElementById('friends-list-area').classList.remove('hidden');
            document.getElementById('friend-dm-area').classList.add('hidden');
        });
    },

    checkAuthStatus: function() {
        // 로컬스토리지 정보 불러오기
        const profile = window.SecurityUtils.getStoredProfile();
        this.userId = profile.userId;
        this.nickname = profile.nickname;
        this.mbtiType = profile.mbtiType;

        const btnAch = document.getElementById('btn-achievements');

        if (!this.userId || this.nickname === 'Guest' || this.nickname === '익명') {
            this.guestOverlay.classList.remove('hidden');
            if(btnAch) btnAch.style.display = 'none';
        } else {
            this.guestOverlay.classList.add('hidden');
            if(btnAch) btnAch.style.display = 'block';
            this.startGlobalChatListening();
            this.startStatusListening();
        }
    },

    // 닉네임 설정 후 UI에서 이 메서드를 호출해주어 인증 상태 재갱신
    updateAuth: function() {
        this.checkAuthStatus();
    },

    switchTab: function(tabName) {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.views.forEach(v => v.classList.remove('active'));

        const tabEl = document.querySelector(`.chat-tab[data-tab="${tabName}"]`);
        if (tabEl) tabEl.classList.add('active');

        if(tabName === 'global') {
            document.getElementById('chat-global-view').classList.add('active');
            this.scrollToBottom(this.globalMsgList);
        } else if(tabName === 'friends') {
            document.getElementById('chat-friends-view').classList.add('active');
            this.renderFriendsList();
        } else {
            document.getElementById('chat-match-view').classList.add('active');
            this.scrollToBottom(this.matchMsgList);
        }
    },

    renderFriendsList: function() {
        const container = document.getElementById('friends-list-container');
        if(!container) return;
        const friends = window.SecurityUtils.getSafeArrayStorage('mbti_friends', (friend) => {
            const safeFriend = window.SecurityUtils.sanitizeFriend(friend);
            return safeFriend.id && safeFriend.nickname ? safeFriend : null;
        });
        if(friends.length === 0) {
            container.innerHTML = `<div style="color:#aaa; font-size:0.8rem;">아직 친구가 없습니다.<br>랭킹이나 채팅에서 유저 닉네임을 클릭해 친구 추가를 해보세요!</div>`;
            return;
        }
        container.innerHTML = '';
        friends.forEach(friend => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; align-items:center; gap:8px; padding:9px 10px; background:rgba(255,255,255,0.06); border-radius:12px; border:1px solid rgba(255,255,255,0.08); transition:background 0.15s;';
            item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.1)';
            item.onmouseleave = () => item.style.background = 'rgba(255,255,255,0.06)';

            const mbtiInitial = (friend.mbti || '?')[0];
            const avatarColors = { E:'#ff9a9e', I:'#a0c4ff', S:'#f6c90e', N:'#c77dff', T:'#38f9d7', F:'#ffb3de', J:'#90be6d', P:'#ffd166', '?':'#aaa' };
            const avatarColor = avatarColors[mbtiInitial] || '#aaa';

            const safeNickname = window.SecurityUtils.escapeHtml(friend.nickname);
            const safeMbti = window.SecurityUtils.escapeHtml(friend.mbti || '');
            item.innerHTML = `
                <div style="width:32px; height:32px; border-radius:50%; background:${avatarColor}22; border:2px solid ${avatarColor}66; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; color:${avatarColor}; flex-shrink:0;">${friend.mbti ? friend.mbti.slice(0,2) : '?'}</div>
                <div style="flex:1; min-width:0;">
                    <div class="friend-name-btn" style="font-size:0.88rem; color:#fff; font-weight:600; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeNickname}</div>
                    <div style="font-size:0.72rem; color:#888;">${safeMbti}</div>
                </div>
                <button class="btn-friend-dm" style="background:rgba(67,233,123,0.15); border:1px solid rgba(67,233,123,0.35); color:#43e97b; border-radius:8px; padding:5px 9px; cursor:pointer; font-size:0.75rem; white-space:nowrap; flex-shrink:0;">DM</button>
                <button class="btn-friend-mkgr" style="background:rgba(255,8,68,0.15); border:1px solid rgba(255,8,68,0.35); color:#ff6b6b; border-radius:8px; padding:5px 9px; cursor:pointer; font-size:0.75rem; white-space:nowrap; flex-shrink:0;">⚔️</button>
            `;
            item.querySelector('.friend-name-btn').addEventListener('click', () => {
                if(window.ProfileAPI) window.ProfileAPI.openUserProfile(friend.id, friend.nickname, friend.mbti);
            });
            item.querySelector('.btn-friend-dm').addEventListener('click', () => this.openDM(friend.id, friend.nickname, friend.mbti));
            item.querySelector('.btn-friend-mkgr').addEventListener('click', () => {
                if(window.MakgoraAPI) window.MakgoraAPI.challenge(friend.id, friend.nickname);
            });
            container.appendChild(item);
        });
    },

    openDM: function(partnerId, partnerName, partnerMbti) {
        document.getElementById('friends-list-area').classList.add('hidden');
        const dmArea = document.getElementById('friend-dm-area');
        dmArea.classList.remove('hidden');
        dmArea.style.display = 'flex';

        const nameEl = document.getElementById('dm-partner-name');
        const badgeEl = document.getElementById('dm-partner-mbti-badge');
        if(nameEl) nameEl.innerText = partnerName;
        if(badgeEl) badgeEl.innerText = partnerMbti || '';

        this.currentDMPartnerId = partnerId;
        this.currentDMPartnerName = partnerName;

        if(window.ProfileAPI) {
            window.ProfileAPI.currentDmUserId = partnerId;
            window.ProfileAPI.currentDmUserName = partnerName;
        }

        const dmMsgList = document.getElementById('dm-msg-list');
        dmMsgList.innerHTML = '<div style="color:#aaa;font-size:0.8rem;text-align:center;padding:20px 0;">Firebase 연동 시 귓속말 내역이 여기에 표시됩니다.</div>';
    },

    sendDM: function() {
        const input = document.getElementById('dm-msg-input');
        if(!input || !input.value.trim() || !this.currentDMPartnerId) return;
        const text = window.SecurityUtils.sanitizeChatMessage(input.value);
        if(!text) return;
        input.value = '';

        // DM 메시지 Direct 전송 (PrivateRooms 재활용)
        // 로컬 표시
        const dmMsgList = document.getElementById('dm-msg-list');
        this.appendMessage(dmMsgList, {
            userId: this.userId,
            nickname: this.nickname,
            mbtiType: this.mbtiType,
            text: text,
            timestamp: Date.now()
        }, true);
        // Firebase 저장은 별도 DM룸 ID 생성 방식으로 (추후 확장 예정)
    },

    // ==========================================
    // 글로벌 채팅 영역
    // ==========================================
    startGlobalChatListening: function() {
        if (!window.FirebaseAPI || !window.FirebaseAPI.listenGlobalChat) return;
        
        // 기존 리스너 해제 (중복 호출 시)
        if(this.listeners.global) this.listeners.global.off();
        
        this.globalMsgList.innerHTML = ''; // 비우기
        
        this.listeners.global = window.FirebaseAPI.listenGlobalChat((key, data) => {
            const isMine = (data.userId === this.userId);
            this.appendMessage(this.globalMsgList, data, isMine);
        });
    },

    sendGlobalMsg: function() {
        const text = window.SecurityUtils.sanitizeChatMessage(this.globalInput.value);
        if(!text) return;
        
        if (window.FirebaseAPI && window.FirebaseAPI.sendGlobalChatMessage) {
            window.FirebaseAPI.sendGlobalChatMessage(this.userId, this.nickname, this.mbtiType, text);
            this.globalInput.value = '';
        }
    },

    // ==========================================
    // 1:1 매칭 영역
    // ==========================================
    startStatusListening: function() {
        if (!window.FirebaseAPI || !window.FirebaseAPI.listenToMatchStatus) return;
        
        if(this.listeners.status) this.listeners.status.off();
        
        this.listeners.status = window.FirebaseAPI.listenToMatchStatus(this.userId, (data) => {
            if(data.status === 'matched') {
                this.handleMatched(data.roomId, data.partnerName);
            } else if(data.status === 'waiting') {
                this.setupWaitingUI();
            } else {
                // idle
                this.setupIdleUI();
                
                // 만약 현재 매칭 중이었는데 idle로 변했다면 방폭임
                if(this.matchStatus === 'matched') {
                    this.appendSysMessage(this.matchMsgList, "상대방이 대화방을 나갔습니다.");
                    this.matchInput.disabled = true;
                    this.matchSendBtn.disabled = true;
                }
            }
            this.matchStatus = data.status || 'idle';
        });
    },

    toggleMatchQueue: async function() {
        if(this.matchStatus === 'idle') {
            // 큐 진입
            this.setupWaitingUI();
            const roomId = await window.FirebaseAPI.joinMatchQueue(this.userId, this.nickname, this.mbtiType);
            if(roomId) {
                // 운 좋게 즉시 잡힘 -> listenToMatchStatus에서 matched 이벤트를 받아 handleMatched 호출됨.
                // 또는 본인이 직접 셋팅
            }
        } else if (this.matchStatus === 'waiting') {
            // 큐 취소
            await window.FirebaseAPI.cancelMatchQueue(this.userId);
            this.setupIdleUI();
        }
    },

    setupIdleUI: function() {
        this.matchStatusArea.classList.remove('hidden');
        this.matchChatArea.classList.add('hidden');
        this.btnStartMatch.innerText = "매칭 시작";
        this.btnStartMatch.classList.remove('waiting');
        this.matchStatusText.innerText = "참여자 중 1명과 랜덤 연결됩니다.";
    },

    setupWaitingUI: function() {
        this.matchStatusArea.classList.remove('hidden');
        this.matchChatArea.classList.add('hidden');
        this.btnStartMatch.innerText = "대기중... (클릭 시 취소)";
        this.btnStartMatch.classList.add('waiting');
        this.matchStatusText.innerText = "상대방을 찾는 중입니다 🔍";
        this.matchStatus = 'waiting';
    },

    handleMatched: function(roomId, partnerName) {
        this.currentRoomId = roomId;
        this.matchStatus = 'matched';
        
        // UI 변경
        this.matchStatusArea.classList.add('hidden');
        this.matchChatArea.classList.remove('hidden');
        
        this.matchPartnerName.innerText = partnerName || '익명';
        this.matchMsgList.innerHTML = ''; // 초기화
        this.matchInput.disabled = false;
        this.matchSendBtn.disabled = false;
        this.appendSysMessage(this.matchMsgList, `${partnerName}님과 연결되었습니다!`);
        
        // 채팅 리스너 세팅
        if(this.listeners.privateMsgs) this.listeners.privateMsgs.off();
        if(this.listeners.privateInfo) this.listeners.privateInfo.off();

        this.listeners.privateMsgs = window.FirebaseAPI.listenPrivateChat(roomId, (key, data) => {
            const isMine = (data.userId === this.userId);
            this.appendMessage(this.matchMsgList, data, isMine);
        });
        
        // 방 닫힘 감지
        this.listeners.privateInfo = window.FirebaseAPI.listenPrivateRoomInfo(roomId, (info) => {
            if(info && info.status === 'closed') {
                this.appendSysMessage(this.matchMsgList, "상대방이 대화방을 나갔습니다.");
                this.matchInput.disabled = true;
                this.matchSendBtn.disabled = true;
                this.listeners.privateMsgs.off(); // 수신 중지
            }
        });
    },

    sendPrivateMsg: function() {
        const text = window.SecurityUtils.sanitizeChatMessage(this.matchInput.value);
        if(!text || this.matchStatus !== 'matched' || !this.currentRoomId) return;
        
        window.FirebaseAPI.sendPrivateMessage(this.currentRoomId, this.userId, this.nickname, text);
        this.matchInput.value = '';
    },

    leavePrivateMatch: async function() {
        if(this.matchStatus === 'matched' && this.currentRoomId) {
            await window.FirebaseAPI.leavePrivateRoom(this.currentRoomId, this.userId);
            // 상태 감지기(listenToMatchStatus)에 의해 idle로 돌아감
            this.setupIdleUI();
        }
    },

    // ==========================================
    // 유틸
    // ==========================================
    appendMessage: function(listDOM, data, isMine) {
        // 차단 필터
        let blocked = [];
        try { blocked = JSON.parse(localStorage.getItem('mbti_blocked') || '[]'); } catch(e){}
        if(blocked.includes(data.userId) && !isMine) {
            return; // 렌더링 스킵
        }

        const row = document.createElement('div');
        row.className = `msg-row ${isMine ? 'my-msg' : 'other'}`;
        
        // 시간 포맷
        const date = data.timestamp ? new Date(data.timestamp) : new Date();
        const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

        const safeNickname = window.SecurityUtils.escapeHtml(window.SecurityUtils.sanitizeNickname(data.nickname) || '익명');
        const safeMbti = window.SecurityUtils.escapeHtml(window.SecurityUtils.sanitizeMbti(data.mbtiType) || '');
        const infoHtml = isMine ? '' : `<div class="msg-info"><strong class="chat-nick" style="cursor:pointer; text-decoration:underline; text-decoration-color:rgba(255,255,255,0.2);">${safeNickname}</strong> <span style="font-size:0.7rem;opacity:0.6;">${safeMbti}</span></div>`;
        const textStr = window.SecurityUtils.escapeHtml(window.SecurityUtils.sanitizeChatMessage(data.text));
        
        row.innerHTML = `
            ${infoHtml}
            <div style="display:flex; align-items:flex-end; gap:5px; flex-direction: ${isMine ? 'row-reverse' : 'row'};">
                <div class="msg-bubble">${textStr}</div>
                <span style="font-size:0.65rem; color:#888; white-space:nowrap;">${timeStr}</span>
            </div>
        `;

        if (!isMine) {
            const nickSpan = row.querySelector('.chat-nick');
            if(nickSpan) {
                nickSpan.addEventListener('click', () => {
                    if (window.ProfileAPI) window.ProfileAPI.openUserProfile(data.userId, data.nickname, data.mbtiType);
                });
            }
        }

        listDOM.appendChild(row);
        
        // 데이터 절약: 50개 제한
        while(listDOM.children.length > 50) {
            listDOM.removeChild(listDOM.firstChild);
        }

        this.scrollToBottom(listDOM);
    },

    appendSysMessage: function(listDOM, text) {
        const row = document.createElement('div');
        row.className = 'sys-msg';
        row.innerText = text;
        listDOM.appendChild(row);
        this.scrollToBottom(listDOM);
    },

    scrollToBottom: function(dom) {
        // DOM 렌더링 후 스크롤을 내리기 위해 약간의 지연
        setTimeout(() => {
            dom.scrollTop = dom.scrollHeight;
        }, 10);
    }
};
