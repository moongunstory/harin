/**
 * profile.js
 * 유저 프로필 조회, 정보 수정, 친구/차단 관리
 */

window.ProfileAPI = {
    init: function() {
        this.cacheDOM();
        this.bindEvents();
        this.initStorage();
    },

    cacheDOM: function() {
        // My Profile
        this.btnMyProfile = document.getElementById('btn-my-profile');
        this.myProfileModal = document.getElementById('my-profile-modal');
        this.myNameInput = document.getElementById('my-profile-name-input');
        this.myMbtiSelect = document.getElementById('my-profile-mbti-select');
        this.btnSaveMyProfile = document.getElementById('btn-save-my-profile');
        this.myNickSpan = document.getElementById('my-profile-nick');
        this.myMbtiSpan = document.getElementById('my-profile-mbti');
        this.myTitleSpan = document.getElementById('my-profile-title');

        // User Profile
        this.userProfileModal = document.getElementById('user-profile-modal');
        this.upTitle = document.getElementById('up-title');
        this.upNickname = document.getElementById('up-nickname');
        this.upMbti = document.getElementById('up-mbti');
        this.upStats = document.getElementById('up-stats');
        
        // Buttons
        this.btnUpWhisper = document.getElementById('btn-up-whisper');
        this.btnUpFriend = document.getElementById('btn-up-friend');
        this.btnUpBlock = document.getElementById('btn-up-block');
        this.btnUpMakgora = document.getElementById('btn-up-makgora');

        this.closeButtons = document.querySelectorAll('.close-modal-btn');
    },

    bindEvents: function() {
        if(this.btnMyProfile) {
            this.btnMyProfile.addEventListener('click', () => this.openMyProfile());
        }
        if(this.btnSaveMyProfile) {
            this.btnSaveMyProfile.addEventListener('click', () => this.saveMyProfile());
        }

        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                document.getElementById(targetId).classList.add('hidden');
            });
        });
        
        if(this.btnUpBlock) this.btnUpBlock.addEventListener('click', () => this.blockUser(this.currentSelectedUserId));
        if(this.btnUpFriend) this.btnUpFriend.addEventListener('click', () => this.toggleFriend(this.currentSelectedUserId, this.currentSelectedUserName));
        
        // 내 프로필 - 친구 목록
        const btnFriends = document.getElementById('btn-show-friends');
        if(btnFriends) btnFriends.addEventListener('click', () => {
            this.openFriendsModal();
        });

        // 내 프로필 - 차단 목록
        const btnBlocked = document.getElementById('btn-show-blocked');
        if(btnBlocked) btnBlocked.addEventListener('click', () => {
            this.openBlockedModal();
        });
        
        // TODO: Whisper
        if(this.btnUpWhisper) this.btnUpWhisper.addEventListener('click', () => {
            const friends = JSON.parse(localStorage.getItem('mbti_friends') || '[]');
            if (!friends.find(f => f.id === this.currentSelectedUserId)) {
                alert("친구가 되어야 귓속말을 보낼 수 있습니다.");
                return;
            }
            
            // 친구 탭의 DM으로 연결
            const modal = document.getElementById('user-profile-modal');
            if(modal) modal.classList.add('hidden');
            if(window.ChatUI) {
                window.ChatUI.switchTab('friends');
                window.ChatUI.openDM(this.currentSelectedUserId, this.currentSelectedUserName);
                // 채팅 사이드바 열기
                const sidebar = document.getElementById('chat-sidebar');
                if(sidebar) sidebar.classList.add('open');
            }
        });

        // 막고라 신청
        if(this.btnUpMakgora) this.btnUpMakgora.addEventListener('click', () => {
            const modal = document.getElementById('user-profile-modal');
            if(modal) modal.classList.add('hidden');
            if(window.MakgoraAPI) {
                window.MakgoraAPI.challenge(this.currentSelectedUserId, this.currentSelectedUserName);
            } else {
                alert('막고라 시스템 로딩 중입니다. 잠시 후 다시 시도해주세요.');
            }
        });

        // 업적 버튼 (헤더)
        const btnAch = document.getElementById('btn-achievements');
        if(btnAch) btnAch.addEventListener('click', () => this.openAchievementModal());

        // 랜덤 1vs1 막고라 버튼 (헤더) 
        const btnRandomMakgora = document.getElementById('btn-random-makgora');
        if(btnRandomMakgora) btnRandomMakgora.addEventListener('click', () => { 
            if(window.MakgoraAPI) window.MakgoraAPI.startMatchQueue();
        });

        // 10판 전적 보기 버튼
        const btnHistory = document.getElementById('btn-show-makgora-history');
        if (btnHistory) btnHistory.addEventListener('click', () => {
            const userId = localStorage.getItem('mbti_userid');
            if (userId) this.loadMakgoraHistory(userId);
        });

        // ── AppBar 이벤트 ──────────────────────────
        // ⋮ 더보기 메뉴 토글 (DM)
        const btnDmMore = document.getElementById('btn-dm-more');
        const dmMoreMenu = document.getElementById('dm-more-menu');
        if(btnDmMore && dmMoreMenu) {
            btnDmMore.addEventListener('click', (e) => {
                e.stopPropagation();
                dmMoreMenu.classList.toggle('hidden');
            });
        }

        // ⋮ 더보기 메뉴 토글 (1:1 매칭)
        const btnMatchMore = document.getElementById('btn-match-more');
        const matchMoreMenu = document.getElementById('match-more-menu');
        if(btnMatchMore && matchMoreMenu) {
            btnMatchMore.addEventListener('click', (e) => {
                e.stopPropagation();
                matchMoreMenu.classList.toggle('hidden');
            });
        }

        // 외부 클릭 시 메뉴 닫기
        document.addEventListener('click', () => {
            if(dmMoreMenu) dmMoreMenu.classList.add('hidden');
            if(matchMoreMenu) matchMoreMenu.classList.add('hidden');
        });

        // DM AppBar - 프로필 버튼들
        const btnDmProfile = document.getElementById('btn-dm-profile');
        if(btnDmProfile) btnDmProfile.addEventListener('click', () => {
            if(dmMoreMenu) dmMoreMenu.classList.add('hidden');
            if(this.currentDmUserId) this.openUserProfile(this.currentDmUserId, this.currentDmUserName);
        });

        const btnDmMakgora = document.getElementById('btn-dm-makgora');
        if(btnDmMakgora) btnDmMakgora.addEventListener('click', () => {
            if(dmMoreMenu) dmMoreMenu.classList.add('hidden');
            if(this.currentDmUserId && window.MakgoraAPI) {
                window.MakgoraAPI.challenge(this.currentDmUserId, this.currentDmUserName);
            }
        });

        const btnDmBlock = document.getElementById('btn-dm-block');
        if(btnDmBlock) btnDmBlock.addEventListener('click', () => {
            if(dmMoreMenu) dmMoreMenu.classList.add('hidden');
            if(this.currentDmUserId) this.blockUser(this.currentDmUserId);
        });

        // DM 상단 이름 클릭 → 프로필
        const dmPartnerBtn = document.getElementById('dm-partner-profile-btn');
        if(dmPartnerBtn) dmPartnerBtn.addEventListener('click', () => {
            if(this.currentDmUserId) this.openUserProfile(this.currentDmUserId, this.currentDmUserName);
        });

        // 1:1 매칭 AppBar - 프로필 버튼들
        const btnMatchProfile = document.getElementById('btn-match-profile');
        if(btnMatchProfile) btnMatchProfile.addEventListener('click', () => {
            if(matchMoreMenu) matchMoreMenu.classList.add('hidden');
            if(this.currentMatchUserId) this.openUserProfile(this.currentMatchUserId, this.currentMatchUserName);
        });

        const btnMatchBlock = document.getElementById('btn-match-block');
        if(btnMatchBlock) btnMatchBlock.addEventListener('click', () => {
            if(matchMoreMenu) matchMoreMenu.classList.add('hidden');
            if(this.currentMatchUserId) this.blockUser(this.currentMatchUserId);
        });

        // 1:1 매칭 상단 이름 클릭 → 프로필
        const matchPartnerBtn = document.getElementById('match-partner-profile-btn');
        if(matchPartnerBtn) matchPartnerBtn.addEventListener('click', () => {
            if(this.currentMatchUserId) this.openUserProfile(this.currentMatchUserId, this.currentMatchUserName);
        });
    },

    initStorage: function() {
        if (!localStorage.getItem('mbti_blocked')) localStorage.setItem('mbti_blocked', JSON.stringify([]));
        if (!localStorage.getItem('mbti_equipped_title')) localStorage.setItem('mbti_equipped_title', '');

        // 더이상 더미 친구 데이터를 삽입하지 않습니다 (친구봇 삭제).
    },

    openAchievementModal: function() {
        const modal = document.getElementById('achievement-modal');
        const listEl = document.getElementById('achievement-list-full');
        if(!modal || !listEl) return;

        if(!window.AchievementAPI) {
            listEl.innerHTML = '<p style="color:#aaa">업적 시스템 로딩 중...</p>';
        } else {
            const all = window.AchievementAPI.getAll();
            const unlocked = all.filter(a => a.unlocked);
            const normalAch = all.filter(a => !a.isHidden);
            const hiddenAch = all.filter(a => a.isHidden);

            let htmlString = `
                <div style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">
                    달성: <span style="color:#f6c90e; font-weight:bold;">${unlocked.length}</span> / ${all.length}
                </div>
                ${normalAch.map(a => `
                    <div onclick="${a.unlocked ? `window.ProfileAPI._equipAchievement('${a.id}')` : ''}" 
                         style="cursor:${a.unlocked ? 'pointer' : 'default'};
                                padding:10px 14px; border-radius:10px;
                                background:${a.unlocked ? 'rgba(246,201,14,0.1)' : 'rgba(255,255,255,0.03)'};
                                border:1px solid ${a.unlocked ? 'rgba(246,201,14,0.35)' : 'rgba(255,255,255,0.07)'};
                                display:flex; align-items:center; gap:10px;
                                filter:${a.unlocked ? 'none' : 'grayscale(1) opacity(0.3)'};
                                margin-bottom: 6px;
                                transition: background 0.2s;">
                        <div style="flex:1;">
                            <div style="font-size:0.95rem; font-weight:700; color:${a.unlocked ? '#fff' : '#888'}">${a.title}</div>
                            <div style="font-size:0.75rem; color:#aaa; margin-top:3px;">${a.desc}</div>
                        </div>
                        ${a.unlocked ? '<span style="font-size:0.75rem; color:#f6c90e; white-space:nowrap; border:1px solid rgba(246,201,14,0.4); padding:3px 8px; border-radius:10px;">장착</span>' : '<span style="font-size:0.75rem; color:#555;">🔒</span>'}
                    </div>
                `).join('')}
            `;

            if (hiddenAch.length > 0) {
                htmlString += `
                    <div style="font-size:0.9rem; color:#f6c90e; margin-top:15px; margin-bottom:6px; font-weight:800; letter-spacing:1px; text-align:center; padding-bottom:5px; border-bottom:1px dashed rgba(246,201,14,0.3);">✨ 특별 / 히든 업적 ✨</div>
                    ${hiddenAch.map(a => `
                        <div onclick="${a.unlocked ? `window.ProfileAPI._equipAchievement('${a.id}')` : ''}" 
                             style="cursor:${a.unlocked ? 'pointer' : 'default'};
                                    padding:10px 14px; border-radius:10px; margin-bottom:6px;
                                    background:${a.unlocked ? 'linear-gradient(45deg, rgba(230,104,60,0.2), rgba(220,39,67,0.2))' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${a.unlocked ? 'rgba(230,104,60,0.5)' : 'rgba(255,255,255,0.07)'};
                                    display:flex; align-items:center; gap:10px;
                                    filter:${a.unlocked ? 'none' : 'grayscale(1) opacity(0.3)'};
                                    box-shadow:${a.unlocked ? '0 0 10px rgba(230,104,60,0.2)' : 'none'};
                                    transition: background 0.2s;">
                            <div style="flex:1;">
                                <div style="font-size:0.95rem; font-weight:800; color:${a.unlocked ? '#ffda79' : '#888'}; text-shadow:${a.unlocked ? '0 0 5px rgba(255,218,121,0.5)' : 'none'}">${a.title}</div>
                                <div style="font-size:0.75rem; color:${a.unlocked ? '#ddd' : '#aaa'}; margin-top:3px;">${a.desc}</div>
                            </div>
                            ${a.unlocked ? '<span style="font-size:0.75rem; color:#ffda79; white-space:nowrap; border:1px solid rgba(230,104,60,0.4); padding:3px 8px; border-radius:10px;">장착</span>' : '<span style="font-size:0.75rem; color:#555;">🔒</span>'}
                        </div>
                    `).join('')}
                `;
            }

            listEl.innerHTML = htmlString;
        }

        modal.classList.remove('hidden');
    },

    openMyProfile: function() {
        const userId = localStorage.getItem('mbti_userid');
        const nickname = localStorage.getItem('mbti_nickname');
        const mbti = localStorage.getItem('mbti_type');
        const title = localStorage.getItem('mbti_equipped_title') || '없음';
        const bio = localStorage.getItem('mbti_bio') || '';

        if (!userId || nickname === 'Guest') {
            alert("게스트는 프로필을 사용할 수 없습니다. 닉네임 설정을 먼저 진행해주세요.");
            document.getElementById('nickname-modal').classList.remove('hidden');
            return;
        }

        this.myNickSpan.innerText = nickname;
        this.myMbtiSpan.innerText = mbti || '미설정';
        this.myTitleSpan.innerText = title;
        
        this.myNameInput.value = nickname;
        if(mbti) this.myMbtiSelect.value = mbti;

        // bio 로드
        const bioInput = document.getElementById('my-profile-bio-input');
        if(bioInput) bioInput.value = bio;

        // 업적 목록 렌더링
        this._renderMyAchievements();

        // 막고라 전적 렌더링 + 최근 10판
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            const db = window.firebase.database();
            
            // 1. 전체 전적
            db.ref(`makgoraStats/${userId}`).once('value').then(snap => {
                const data = snap.val() || {wins:0, losses:0, draws:0};
                const total = data.wins + data.losses + data.draws;
                const drawText = data.draws ? ` ${data.draws}무` : '';
                const recordText = `${total}전 ${data.wins}승 ${data.losses}패${drawText}`;
                let statsEl = document.getElementById('my-makgora-record-display');
                if(statsEl) {
                    statsEl.style.display = 'none';
                }
                const historyBtn = document.getElementById('btn-show-makgora-history');
                if(historyBtn) {
                    historyBtn.innerText = `⚔️ ${recordText} (10전 전적 보기)`;
                }
            });

            // 2. 최근 10개 기록
            db.ref(`makgoraHistory/${userId}`).orderByChild('timestamp').limitToLast(10).once('value').then(snap => {
                const historyList = document.getElementById('my-makgora-history-list');
                if(!historyList) return;
                
                if (!snap.exists()) {
                    historyList.innerHTML = '<div style="color:#aaa; font-size:0.8rem; text-align:center;">최근 막고라 전적이 없습니다.</div>';
                    return;
                }
                
                const records = [];
                snap.forEach(child => records.unshift(child.val())); // 최신순
                
                historyList.innerHTML = '';
                records.forEach(r => {
                    const icon = r.result === 'win' ? '🏆' : r.result === 'draw' ? '🤝' : '💀';
                    const color = r.result === 'win' ? '#43e97b' : r.result === 'draw' ? '#f6c90e' : '#ff6b6b';
                    const botBadge = r.isBot ? '<span style="font-size:0.7rem; color:#aaa; margin-left:4px;">🤖</span>' : '';
                    const date = new Date(r.timestamp);
                    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
                    
                    const el = document.createElement('div');
                    el.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:4px; font-size:0.85rem;`;
                    el.innerHTML = `
                        <div style="flex:1;">
                            <span class="history-rival" style="font-weight:600; cursor:${r.isBot ? 'default' : 'pointer'}; text-decoration:${r.isBot ? 'none' : 'underline'}" data-rival="${r.rivalId}" data-name="${r.rivalName}">${r.rivalName}</span>${botBadge}
                        </div>
                        <div style="color:${color}; font-weight:bold; width:40px; text-align:center;">${icon}</div>
                        <div style="font-size:0.7rem; color:#888; width:60px; text-align:right;">${dateStr}</div>
                    `;
                    
                    if (!r.isBot) {
                        el.querySelector('.history-rival').addEventListener('click', () => {
                            window.ProfileAPI.openUserProfile(r.rivalId, r.rivalName);
                        });
                    }
                    historyList.appendChild(el);
                });
            });
        }

        this.myProfileModal.classList.remove('hidden');
    },

    saveMyProfile: async function() {
        const newName = this.myNameInput.value.trim();
        const newMbti = this.myMbtiSelect.value;
        const bioInput = document.getElementById('my-profile-bio-input');
        const newBio = bioInput ? bioInput.value.trim() : '';

        if(!newName) {
            alert("닉네임을 입력하세요.");
            return;
        }

        const userId = localStorage.getItem('mbti_userid');

        // 중복 검사
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            const db = window.firebase.database();
            const nicknameLower = newName.toLowerCase().replace(/\s+/g, '');
            const snap = await db.ref(`Nicknames/${nicknameLower}`).once('value');
            if (snap.exists() && snap.val() !== userId) {
                alert("🛑 이미 사용 중인 닉네임이에요.");
                return;
            }
        }

        localStorage.setItem('mbti_nickname', newName);
        localStorage.setItem('mbti_type', newMbti);
        localStorage.setItem('mbti_bio', newBio);

        this.myNickSpan.innerText = newName;
        this.myMbtiSpan.innerText = newMbti;

        if (window.FirebaseAPI && window.FirebaseAPI.registerUser) {
            window.FirebaseAPI.registerUser(userId, newName, newMbti);
        }
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            const db = window.firebase.database();
            db.ref(`Users/${userId}`).update({
                nickname: newName,
                mbti_type: newMbti,
                bio: newBio,
                equipped_title: localStorage.getItem('mbti_equipped_title') || ''
            });
        }
        if (window.ChatUI) window.ChatUI.updateAuth();

        alert("프로필 정보가 수정되었습니다.");
    },

    _renderMyAchievements: function() {
        // 동적으로 업적 섹션 삽입
        let achSection = document.getElementById('my-achievement-section');
        if(!achSection) {
            achSection = document.createElement('div');
            achSection.id = 'my-achievement-section';
            achSection.style.cssText = 'margin-top:15px; text-align:left;';
            this.btnSaveMyProfile.parentNode.insertBefore(achSection, this.btnSaveMyProfile.nextSibling.nextSibling);
        }
        
        if(!window.AchievementAPI) return;
        const all = window.AchievementAPI.getAll();
        const unlocked = all.filter(a => a.unlocked);

        const normalAch = all.filter(a => !a.isHidden);
        const hiddenAch = all.filter(a => a.isHidden);

        let htmlString = `
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                🏆 달성한 업적 <span style="color:#f6c90e; font-weight:bold;">${unlocked.length}</span> / ${all.length}
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; max-height:220px; overflow-y:auto; padding-right:4px;">
                ${normalAch.map(a => `
                    <div onclick="window.ProfileAPI._equipAchievement('${a.id}')" style="cursor:${a.unlocked?'pointer':'default'}; padding:6px 10px; border-radius:8px; background:${a.unlocked?'rgba(246,201,14,0.12)':'rgba(255,255,255,0.03)'}; border:1px solid ${a.unlocked?'rgba(246,201,14,0.3)':'rgba(255,255,255,0.07)'}; display:flex; align-items:center; gap:8px; filter:${a.unlocked?'none':'grayscale(1) opacity(0.35)'};">
                        <span style="font-size:0.95rem; white-space:nowrap;">${a.title}</span>
                        <span style="font-size:0.7rem; color:#aaa; flex:1;">${a.desc}</span>
                        ${a.unlocked ? '<span style="font-size:0.7rem;color:#f6c90e;white-space:nowrap;">장착</span>' : ''}
                    </div>
                `).join('')}
        `;

        if (hiddenAch.length > 0) {
            htmlString += `
                <div style="font-size:0.8rem; color:#f6c90e; margin-top:8px; margin-bottom:2px; font-weight:bold; letter-spacing:1px;">✨ 히든 업적 ✨</div>
                ${hiddenAch.map(a => `
                    <div onclick="window.ProfileAPI._equipAchievement('${a.id}')" style="cursor:pointer; padding:6px 10px; border-radius:8px; background:linear-gradient(45deg, rgba(230,104,60,0.15), rgba(220,39,67,0.15)); border:1px solid rgba(230,104,60,0.4); display:flex; align-items:center; gap:8px; box-shadow: 0 0 8px rgba(230,104,60,0.2);">
                        <span style="font-size:0.95rem; white-space:nowrap; color:#ffda79; font-weight:800; text-shadow:0 0 5px rgba(255,218,121,0.5);">${a.title}</span>
                        <span style="font-size:0.7rem; color:#ddd; flex:1;">${a.desc}</span>
                        <span style="font-size:0.7rem;color:#ffda79;white-space:nowrap; font-weight:bold;">장착</span>
                    </div>
                `).join('')}
            `;
        }
        
        htmlString += `</div>`;
        achSection.innerHTML = htmlString;
    },

    _equipAchievement: function(id) {
        if(!window.AchievementAPI) return;
        const title = window.AchievementAPI.equipTitle(id);
        if(title) {
            if(this.myTitleSpan) this.myTitleSpan.innerText = title;
            alert(`"${title}" 칭호를 장착했습니다!`);
        }
    },

    openUserProfile: function(userId, fallbackName, fallbackMbti) {
        if (!userId) return;
        if (userId === localStorage.getItem('mbti_userid')) {
            this.openMyProfile();
            return;
        }

        this.currentSelectedUserId = userId;
        this.currentSelectedUserName = fallbackName;
        
        this.upNickname.innerText = fallbackName || '로딩중...';
        this.upMbti.innerText = fallbackMbti || '비공개';
        this.upTitle.innerText = '';

        // bio 초기화
        const upBio = document.getElementById('up-bio');
        if(upBio) upBio.innerText = '';

        this.upStats.innerHTML = '데이터 조회 중...';
        
        // 차단/친구 상태 체크
        const blocked = JSON.parse(localStorage.getItem('mbti_blocked') || '[]');
        if(blocked.includes(userId)) {
            this.btnUpBlock.innerText = "차단 해제하기";
            this.btnUpBlock.style.color = '#fff';
            this.btnUpBlock.style.borderColor = '#fff';
        } else {
            this.btnUpBlock.innerText = "🚫 차단하기";
            this.btnUpBlock.style.color = '#ff6b6b';
            this.btnUpBlock.style.borderColor = '#ff6b6b';
        }
        
        const friends = JSON.parse(localStorage.getItem('mbti_friends') || '[]');
        if(friends.find(f => f.id === userId)) {
            this.btnUpFriend.innerText = "❌ 친구 삭제";
        } else {
            this.btnUpFriend.innerText = "➕ 친구 추가";
        }

        this.userProfileModal.classList.remove('hidden');

        // Firebase 통계 가져오기
        if(window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            const db = window.firebase.database();
            const colors = window.mbtiColors || {
                'E': '#FF5A5F', 'I': '#4A90E2', 'S': '#F5A623', 'N': '#9013FE',
                'T': '#00B4D8', 'F': '#FB6F92', 'J': '#2ECC71', 'P': '#F39C12'
            };
            db.ref(`Users/${userId}`).once('value').then(snap => {
                if(snap.exists()) {
                    const data = snap.val();
                    this.upNickname.innerText = data.nickname;
                    this.upMbti.innerText = data.mbti_type || fallbackMbti;
                    this.upTitle.innerText = data.equipped_title || '';
                    if (upBio) {
                        upBio.innerText = data.bio || '한 줄 소개가 없습니다.';
                    }
                    
                    const clicks = data.clicks || {};
                    const totalClicks = data.total_clicks ? data.total_clicks.toLocaleString() : 0;
                    const achievementCount = data.achievement_count != null ? `${data.achievement_count}개` : '비공개';
                    this.upStats.innerHTML = `
                        <div style="grid-column: 1 / -1; font-weight:bold; color:#fff; border-bottom:1px solid #444; padding-bottom:4px; margin-bottom:4px;">총 기여도: ${totalClicks} 번</div>
                        <div style="grid-column: 1 / -1; font-weight:bold; color:#f6c90e; margin-bottom:6px;">업적: ${achievementCount}</div>
                        <div style="color:${colors['E']}">E: ${clicks.E||0}</div>
                        <div style="color:${colors['I']}">I: ${clicks.I||0}</div>
                        <div style="color:${colors['S']}">S: ${clicks.S||0}</div>
                        <div style="color:${colors['N']}">N: ${clicks.N||0}</div>
                        <div style="color:${colors['T']}">T: ${clicks.T||0}</div>
                        <div style="color:${colors['F']}">F: ${clicks.F||0}</div>
                        <div style="color:${colors['J']}">J: ${clicks.J||0}</div>
                        <div style="color:${colors['P']}">P: ${clicks.P||0}</div>
                    `;
                    
                    db.ref(`makgoraStats/${userId}`).once('value').then(mSnap => {
                        const mData = mSnap.val() || {wins:0, losses:0, draws:0};
                        this.upStats.innerHTML += `
                            <div style="grid-column: 1 / -1; font-weight:bold; color:#ff6b6b; margin-top:6px; border-top:1px solid #444; padding-top:6px;">
                                <button onclick="window.ProfileAPI.loadMakgoraHistory('${userId}')" style="background: linear-gradient(90deg, #ff0844, #ffb199); color:#fff; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; font-weight:800; width:100%;">⚔️ ${mData.wins} 전 ${mData.wins} 승 ${mData.losses} 패</button>
                            </div>`;
                        
                        const myId = localStorage.getItem('mbti_userid');
                        if (myId) {
                            db.ref(`HeadToHead/${myId}/${userId}`).once('value').then(hSnap => {
                                if (hSnap.exists()) {
                                    const hData = hSnap.val();
                                    this.upStats.innerHTML += `
                                        <div style="grid-column: 1 / -1; font-weight:800; color:#f6c90e; margin-top:2px;">
                                            ⚔️ 나와의 전적: ${hData.wins}승 ${hData.draws}무 ${hData.losses}패
                                        </div>`;
                                }
                            });
                        }
                    });

                } else {
                    this.upStats.innerHTML = '데이터를 찾을 수 없습니다.';
                }
            });
        } else {
            this.upStats.innerHTML = '네트워크 연결 불가 (Mock 모드)';
        }
    },

    blockUser: function(userId) {
        if(!userId) return;
        let blocked = JSON.parse(localStorage.getItem('mbti_blocked') || '[]');
        if(blocked.includes(userId)) {
            blocked = blocked.filter(id => id !== userId);
            this.btnUpBlock.innerText = "🚫 차단하기";
            this.btnUpBlock.style.color = '#ff6b6b';
            this.btnUpBlock.style.borderColor = '#ff6b6b';
            alert("차단이 해제되었습니다.");
        } else {
            blocked.push(userId);
            this.btnUpBlock.innerText = "차단 해제하기";
            this.btnUpBlock.style.color = '#fff';
            this.btnUpBlock.style.borderColor = '#fff';
            alert("차단되었습니다. 새로 추가되는 메시지는 보이지 않습니다.");
        }
        localStorage.setItem('mbti_blocked', JSON.stringify(blocked));
    },

    toggleFriend: function(userId, nickname) {
        if(!userId) return;
        let friends = JSON.parse(localStorage.getItem('mbti_friends') || '[]');
        if(friends.find(f => f.id === userId)) {
            friends = friends.filter(f => f.id !== userId);
            this.btnUpFriend.innerText = "➕ 친구 추가";
            alert("친구가 삭제되었습니다.");
        } else {
            friends.push({ id: userId, nickname: nickname });
            this.btnUpFriend.innerText = "❌ 친구 삭제";
            alert(`${nickname}님을 친구로 추가했습니다.`);
        }
        localStorage.setItem('mbti_friends', JSON.stringify(friends));
        // 친구 모달 업데이트 (열려있다면)
        const fModal = document.getElementById('friends-manage-modal');
        if (fModal && !fModal.classList.contains('hidden')) {
            this.openFriendsModal();
        }
    },

    openFriendsModal: function() {
        const modal = document.getElementById('friends-manage-modal');
        const listContainer = document.getElementById('friends-manage-list');
        if(!modal || !listContainer) return;

        const friends = JSON.parse(localStorage.getItem('mbti_friends') || '[]');
        if(friends.length === 0) {
            listContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding: 20px 0;">아직 친구가 없습니다.</div>';
        } else {
            listContainer.innerHTML = friends.map(f => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:8px;">
                    <span style="font-weight:bold; color:#fff;">${f.nickname}</span>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.ProfileAPI.openUserProfile('${f.id}', '${f.nickname}')" style="background:#f6c90e; color:#000; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:0.8rem; font-weight:bold;">프로필</button>
                        <button onclick="window.ProfileAPI.toggleFriend('${f.id}', '${f.nickname}')" style="background:#ff6b6b; color:#fff; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:0.8rem; font-weight:bold;">삭제</button>
                    </div>
                </div>
            `).join('');
        }
        modal.classList.remove('hidden');
    },

    openBlockedModal: function() {
        const modal = document.getElementById('blocked-manage-modal');
        const listContainer = document.getElementById('blocked-manage-list');
        if(!modal || !listContainer) return;

        const blocked = JSON.parse(localStorage.getItem('mbti_blocked') || '[]');
        if(blocked.length === 0) {
            listContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding: 20px 0;">차단된 유저가 없습니다.</div>';
        } else {
            listContainer.innerHTML = blocked.map(id => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:8px;">
                    <span style="font-weight:bold; color:#fff; word-break: break-all;">${id}</span>
                    <button onclick="window.ProfileAPI.removeBlockedUser('${id}')" style="background:#ff6b6b; color:#fff; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:0.8rem; font-weight:bold;">차단 해제</button>
                </div>
            `).join('');
        }
        modal.classList.remove('hidden');
    },

    removeBlockedUser: function(userId) {
        let blocked = JSON.parse(localStorage.getItem('mbti_blocked') || '[]');
        blocked = blocked.filter(id => id !== userId);
        localStorage.setItem('mbti_blocked', JSON.stringify(blocked));
        this.openBlockedModal(); // 리렌더링
    },

    loadMakgoraHistory: function(userId) {
        const historyModal = document.getElementById('makgora-history-modal');
        const listEl = document.getElementById('my-makgora-history-list');
        if (!historyModal || !listEl) return;

        listEl.innerHTML = '<div style="color:#aaa; font-size:0.95rem; text-align:center; padding:20px;">전적을 불러오는 중입니다...</div>';
        historyModal.classList.remove('hidden');

        const showHistoryRows = history => {
            listEl.innerHTML = '';
            history.forEach(h => {
                const statusLabel = h.result === 'win' ? '승리' : h.result === 'draw' ? '무승부' : '패배';
                const statusColor = h.result === 'win' ? '#43e97b' : h.result === 'draw' ? '#f6c90e' : '#ff6b6b';
                const rivalDisplay = h.isBot ? `${h.rivalName} (봇)` : h.rivalName;
                const forfeitLabel = h.forfeit ? (h.result === 'win' ? '기권 승' : '기권 패') : '';
                const scoreLine = h.result === 'draw'
                    ? `무승부 — 양쪽 모두 ${h.winnerHP || 0} HP로 종료`
                    : `${h.result === 'win' ? '승자' : '패자'} 체력 ${h.winnerHP || 0} HP`;
                const subtitleText = forfeitLabel ? `${forfeitLabel} · ${scoreLine}` : scoreLine;
                const date = new Date(h.timestamp);
                const dateText = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;

                const row = document.createElement('div');
                row.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:14px 16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; margin-bottom:10px; cursor:' + (h.rivalId && !h.isBot ? 'pointer' : 'default') + ';';
                if (h.rivalId && !h.isBot) {
                    row.addEventListener('click', () => {
                        window.ProfileAPI.openUserProfile(h.rivalId, h.rivalName);
                    });
                }

                const headerRow = document.createElement('div');
                headerRow.style.display = 'flex';
                headerRow.style.justifyContent = 'space-between';
                headerRow.style.alignItems = 'center';

                const opponentName = document.createElement('div');
                opponentName.style.fontWeight = '700';
                opponentName.style.color = '#fff';
                opponentName.textContent = rivalDisplay;

                const statusBadge = document.createElement('span');
                statusBadge.style.background = statusColor;
                statusBadge.style.color = '#121212';
                statusBadge.style.fontWeight = '800';
                statusBadge.style.borderRadius = '999px';
                statusBadge.style.padding = '4px 10px';
                statusBadge.style.fontSize = '0.8rem';
                statusBadge.textContent = statusLabel;

                headerRow.appendChild(opponentName);
                headerRow.appendChild(statusBadge);

                const detailRow = document.createElement('div');
                detailRow.style.fontSize = '0.82rem';
                detailRow.style.color = '#ccc';
                detailRow.textContent = subtitleText;

                const dateRow = document.createElement('div');
                dateRow.style.fontSize = '0.75rem';
                dateRow.style.color = '#777';
                dateRow.textContent = dateText;

                row.appendChild(headerRow);
                row.appendChild(detailRow);
                row.appendChild(dateRow);
                listEl.appendChild(row);
            });
        };

        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            const db = window.firebase.database();
            db.ref(`makgoraHistory/${userId}`).orderByChild('timestamp').limitToLast(10).once('value').then(snap => {
                if (snap.exists()) {
                    const history = [];
                    snap.forEach(child => {
                        history.push(child.val());
                    });
                    history.sort((a, b) => b.timestamp - a.timestamp);
                    showHistoryRows(history);
                } else {
                    listEl.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">아직 막고라 전적이 없습니다.</div>';
                }
            }).catch(() => {
                listEl.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">전적을 불러올 수 없습니다.</div>';
            });
        } else {
            listEl.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">아직 막고라 전적이 없습니다.</div>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.ProfileAPI.init();
});
