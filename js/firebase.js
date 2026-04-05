/**
 * firebase.js
 * Firebase 연동 및 데이터 처리
 */

// TODO: 본인의 Firebase 프로젝트의 Config 객체로 반드시 교체하세요.
const firebaseConfig = {
    apiKey: "AIzaSyBaqtbr6e01UMvQpKGQa8Ajo1Hif43Tj6A",
    authDomain: "mbti-harin.firebaseapp.com",
    databaseURL: "https://mbti-harin-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mbti-harin",
    storageBucket: "mbti-harin.firebasestorage.app",
    messagingSenderId: "188985042497",
    appId: "1:188985042497:web:64a7e7fc921ede2ca208c0",
    measurementId: "G-1MTFYKQBES"
};

// Initialize Firebase (Compat SDK)
const isPlaceholder = firebaseConfig.apiKey.includes("YOUR_");

if (typeof firebase !== 'undefined' && !firebase.apps.length && !isPlaceholder) {
    try {
        firebase.initializeApp(firebaseConfig);
    } catch(e) {
        console.warn("Firebase init failed. Using mock mode.");
    }
} else if (isPlaceholder) {
    console.warn("Firebase config is placeholder. Operating in Mock Mode.");
}

const db = (typeof firebase !== 'undefined' && firebase.apps.length && !isPlaceholder) ? firebase.database() : null;

// Firebase 익명 로그인 (보안 규칙 우회용)
if (typeof firebase !== 'undefined' && firebase.apps.length && !isPlaceholder && firebase.auth) {
    firebase.auth().signInAnonymously().catch((error) => {
        console.error("Firebase 익명 로그인 실패 (막고라/전적 기록 불가):", error);
    });
}

const defaultStats = {
    ei: { E: 0, I: 0 },
    sn: { S: 0, N: 0 },
    tf: { T: 0, F: 0 },
    jp: { J: 0, P: 0 }
};

// Mock 상태 관리를 위한 변수 (Firebase 미연동 시 로컬 테스트용)
const mockData = {
    users: {},
    listeners: { ranking: [], global: [] }
};

window.FirebaseAPI = {
    // 앱 초기 데이터 (안전 장치)
    getInitialData: async () => {
        if (!db) return defaultStats;
        try {
            // DB 무한 대기 방지 (3초 타임아웃)
            const snapshot = await Promise.race([
                db.ref('GlobalStats').once('value'),
                new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 3000))
            ]);

            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                // 초기값이 없을 경우 강제 세팅 시도를 생략 (트랜잭션으로 자동 생성됨)
                return defaultStats;
            }
        } catch (error) {
            console.error("Firebase getInitialData 에러 (Mock 모드 전환):", error);
            return defaultStats;
        }
    },

    // 클릭 시 트랜잭션 (글로벌 총합 + 배수 지원)
    incrementCount: async (axis, type, userId, nickname, mbtiType, adds = 1) => {
        userId = window.SecurityUtils.sanitizeUserId(userId);
        nickname = window.SecurityUtils.sanitizeNickname(nickname);
        mbtiType = window.SecurityUtils.sanitizeMbti(mbtiType);
        adds = Number.isFinite(adds) ? Math.max(1, Math.min(50, Math.floor(adds))) : 1;
        if (!db) {
            // Mock 처리 (로컬 테스트용)
            if (userId) {
                if (!mockData.users[userId]) {
                    mockData.users[userId] = {
                        id: userId,
                        nickname: nickname || '익명',
                        mbti_type: mbtiType || '',
                        total_clicks: 0,
                        clicks: {} // 버튼별 클릭 수 추적
                    };
                }
                // 업데이트
                const user = mockData.users[userId];
                user.nickname = nickname || user.nickname;
                user.mbti_type = mbtiType || user.mbti_type;
                user.total_clicks = (user.total_clicks || 0) + adds;
                if (!user.clicks) user.clicks = {};
                user.clicks[type] = (user.clicks[type] || 0) + adds; // e.g. clicks.E += adds

                // 랭킹 리스너 호출 (닉네임 있는 유저만 전달)
                const usersArr = Object.values(mockData.users).filter(u =>
                    u.nickname && u.nickname !== 'Guest' && u.nickname !== '익명'
                );
                mockData.listeners.ranking.forEach(cb => cb(usersArr));
            }
            return;
        }

        const globalRef = db.ref(`GlobalStats/${axis}/${type}`);
        globalRef.transaction((currentValue) => {
            return (currentValue || 0) + adds;
        });

        // 닉네임이 있고 게스트가 아닌 경우만 Users DB에 기록
        if (userId && nickname && nickname !== 'Guest') {
            const userRef = db.ref(`Users/${userId}`);
            userRef.transaction((userData) => {
                if (userData) {
                    userData.total_clicks = (userData.total_clicks || 0) + adds;
                    userData.nickname = nickname;
                    userData.mbti_type = mbtiType || userData.mbti_type || '';
                    // 버튼별 클릭 수 저장
                    if (!userData.clicks) userData.clicks = {};
                    userData.clicks[type] = (userData.clicks[type] || 0) + adds;
                    return userData;
                } else {
                    const initClicks = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
                    initClicks[type] = adds;
                    return {
                        nickname: nickname,
                        mbti_type: mbtiType || '',
                        total_clicks: adds,
                        clicks: initClicks,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP
                    };
                }
            });
        }
    },

    listenToGlobalStats: (callback) => {
        if (!db) {
            mockData.listeners.global.push(callback);
            return;
        }
        db.ref('GlobalStats').on('value', (snapshot) => {
            if(snapshot.exists()) callback(snapshot.val());
        });
    },

    // 월드 메시지 (슈퍼챗) 수신 기능
    listenToSuperChat: (callback) => {
        if (!db) {
            // 목업 환경에서는 임의로 이벤트를 붙일 수 있음 (UI쪽에서 테스트 용도로 폴링하거나 직접 트리거할 수 있게 함)
            mockData.listeners.superchat = mockData.listeners.superchat || [];
            mockData.listeners.superchat.push(callback);
            return;
        }
        const ref = db.ref('events/superchat');
        // 변경 사항(새로운 후원 세트)이 발생할 때마다 알림
        ref.on('value', (snapshot) => {
            if(snapshot.exists()) {
                const data = snapshot.val();
                callback(data);
            }
        });
    },

    // 유저 등록 (닉네임 참가 시 즉시 호출) - 랭킹에 바로 반영
    registerUser: async (userId, nickname, mbtiType) => {
        userId = window.SecurityUtils.sanitizeUserId(userId);
        nickname = window.SecurityUtils.sanitizeNickname(nickname);
        mbtiType = window.SecurityUtils.sanitizeMbti(mbtiType);
        if (!userId || !nickname || nickname === 'Guest') return;

        if (!db) {
            // Mock 모드: 유저 추가 후 랭킹 리스너 즉시 트리거
            if (!mockData.users[userId]) {
                mockData.users[userId] = {
                    id: userId,
                    nickname: nickname,
                    mbti_type: mbtiType || '',
                    total_clicks: 0,
                    clicks: {}
                };
            } else {
                mockData.users[userId].nickname = nickname;
                mockData.users[userId].mbti_type = mbtiType || '';
            }
            // 랭킹 리스너 즉시 갱신
            const usersArr = Object.values(mockData.users).filter(u =>
                u.nickname && u.nickname !== 'Guest' && u.nickname !== '익명'
            );
            mockData.listeners.ranking.forEach(cb => cb(usersArr));
            return;
        }

        // Firebase 실제 연동: Users 노드에 유저 등록
        const userRef = db.ref(`Users/${userId}`);
        const snapshot = await userRef.once('value');
        const nicknameLower = nickname.toLowerCase().replace(/\s+/g, '');
        
        if (!snapshot.exists()) {
            userRef.set({
                nickname: nickname,
                mbti_type: mbtiType || '',
                total_clicks: 0,
                clicks: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            db.ref(`Nicknames/${nicknameLower}`).set(userId);
        } else {
            // 이미 있으면 닉네임/MBTI만 업데이트
            const oldData = snapshot.val();
            if (oldData.nickname && oldData.nickname !== nickname) {
                const oldNickLower = oldData.nickname.toLowerCase().replace(/\s+/g, '');
                db.ref(`Nicknames/${oldNickLower}`).remove();
                db.ref(`Nicknames/${nicknameLower}`).set(userId);
            } else if (!oldData.nickname) {
                db.ref(`Nicknames/${nicknameLower}`).set(userId);
            }
            userRef.update({
                nickname: nickname,
                mbti_type: mbtiType || ''
            });
        }
    },

    // 모든 유저 랭킹 수신 후 프론트에서 필터링 (간단한 MVP용)
    listenToRanking: (callback) => {
        if (!db) {
            mockData.listeners.ranking.push(callback);
            // 초기 호출: 닉네임 있는 유저만 전달하여 "로딩 중" 제거
            const initialUsers = Object.values(mockData.users).filter(u =>
                u.nickname && u.nickname !== 'Guest' && u.nickname !== '익명'
            );
            callback(initialUsers);
            return;
        }
        db.ref('Users').on('value', (snapshot) => {
            const allUsers = [];
            snapshot.forEach((childSnapshot) => {
                allUsers.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(allUsers);
        });
    },

    // ==========================================
    // 여기서부터 채팅 및 1:1 매칭 기능 추가
    // ==========================================

    // 채팅: 글로벌 채팅 전송
    sendGlobalChatMessage: (userId, nickname, mbtiType, text) => {
        userId = window.SecurityUtils.sanitizeUserId(userId);
        nickname = window.SecurityUtils.sanitizeNickname(nickname);
        mbtiType = window.SecurityUtils.sanitizeMbti(mbtiType);
        text = window.SecurityUtils.sanitizeChatMessage(text);
        
        if (!db) {
            // Mock 모드 동작
            const msg = {
                userId, nickname, mbtiType: mbtiType || '', text,
                timestamp: Date.now()
            };
            mockData.listeners.global.forEach(cb => cb('mock_' + Date.now() + Math.random(), msg));
            return;
        }
        
        if (!userId || !nickname || !text) return;

        const chatRef = db.ref('GlobalChat');
        chatRef.push({
            userId, nickname, mbtiType: mbtiType || '', text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            // 프론트엔드 기반 실시간 가비지 컬렉터 (약 300개 한도 유지)
            // 매 전송 시가 아닌 약 10%의 확률로 백그라운드 청소를 수행하여 트래픽 최적화
            if (Math.random() < 0.1) {
                chatRef.once('value', snap => {
                    const count = snap.numChildren();
                    if (count > 300) {
                        const excess = count - 300;
                        chatRef.orderByChild('timestamp').limitToFirst(excess).once('value', oldSnap => {
                            oldSnap.forEach(child => child.ref.remove());
                        });
                    }
                });
            }
        });
    },

    // 채팅: 글로벌 채팅 수신
    listenGlobalChat: (callback) => {
        if (!db) {
            // Mock 모드 동작
            mockData.listeners.global.push(callback);
            return { off: () => {
                const idx = mockData.listeners.global.indexOf(callback);
                if(idx > -1) mockData.listeners.global.splice(idx, 1);
            }}; // 더미 객체 반환
        }

        const ref = db.ref('GlobalChat').limitToLast(50);
        ref.on('child_added', (snapshot) => {
            callback(snapshot.key, snapshot.val());
        });
        return ref;
    },

    // 1:1 매칭: 대기열 진입
    joinMatchQueue: async (userId, nickname, mbtiType) => {
        userId = window.SecurityUtils.sanitizeUserId(userId);
        nickname = window.SecurityUtils.sanitizeNickname(nickname);
        mbtiType = window.SecurityUtils.sanitizeMbti(mbtiType);
        if (!userId || nickname === 'Guest') return null;
        
        if (!db) {
            // Mock 모드: 가상의 봇 삭제 - 이제 봇 매칭되지 않고 대기상태가 유지됨
            return null; // 일단 waiting 반환
        }

        const queueRef = db.ref('MatchQueue');
        const userStatusRef = db.ref(`UserStatus/${userId}`);
        
        // 1. 큐 확인
        const snapshot = await queueRef.orderByChild('timestamp').limitToFirst(1).once('value');
        let partnerId = null;
        let pData = null;
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                if (child.key !== userId) {
                    partnerId = child.key;
                    pData = child.val();
                }
            });
        }
        
        if (partnerId) {
            // 내가 큐에 있는 사람을 잡음 -> 방 생성
            await queueRef.child(partnerId).remove();
            
            const roomId = `room_${Date.now()}_${userId}`;
            const roomData = {};
            roomData[userId] = { nickname, mbtiType: mbtiType || '' };
            roomData[partnerId] = { nickname: pData.nickname, mbtiType: pData.mbtiType || '' };
            
            await db.ref(`PrivateRooms/${roomId}/info`).set({
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                participants: roomData,
                status: 'active'
            });
            
            // 양쪽 유저 상태 업데이트
            await userStatusRef.set({ status: 'matched', roomId: roomId, partnerName: pData.nickname });
            await db.ref(`UserStatus/${partnerId}`).set({ status: 'matched', roomId: roomId, partnerName: nickname });
            
            return roomId;
        } else {
            // 큐에 대기 등록
            await queueRef.child(userId).set({
                nickname, mbtiType: mbtiType || '',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            await userStatusRef.set({ status: 'waiting' });
            return null; // 대기중
        }
    },

    // 1:1 매칭: 내 상태 수신 (누군가 나를 잡아가길 기다림)
    listenToMatchStatus: (userId, callback) => {
        if (!db) {
            mockData.listeners.status = mockData.listeners.status || {};
            mockData.listeners.status[userId] = callback;
            callback({ status: 'idle' });
            return { off: () => { delete mockData.listeners.status[userId]; }};
        }
        const ref = db.ref(`UserStatus/${userId}`);
        ref.on('value', (snapshot) => {
            if (snapshot.exists()) callback(snapshot.val());
            else callback({ status: 'idle' });
        });
        return ref;
    },

    // 1:1 매칭: 큐 이탈
    cancelMatchQueue: async (userId) => {
        if (!db) {
            if(mockData.listeners.status && mockData.listeners.status[userId]) {
                mockData.listeners.status[userId]({ status: 'idle' });
            }
            return;
        }
        await db.ref(`MatchQueue/${userId}`).remove();
        await db.ref(`UserStatus/${userId}`).remove();
    },

    // 1:1 채팅 전송
    sendPrivateMessage: (roomId, userId, nickname, text) => {
        userId = window.SecurityUtils.sanitizeUserId(userId);
        nickname = window.SecurityUtils.sanitizeNickname(nickname);
        text = window.SecurityUtils.sanitizeChatMessage(text);
        if (!roomId || !userId || !nickname || !text) return;
        if (!db) {
            if(mockData.listeners['msg_' + roomId]) {
                mockData.listeners['msg_' + roomId].forEach(cb => cb('msg_'+Date.now(), {
                    userId, nickname, text, timestamp: Date.now()
                }));
            }
            return;
        }
        db.ref(`PrivateRooms/${roomId}/messages`).push().set({
            userId, nickname, text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },

    // 1:1 채팅 수신
    listenPrivateChat: (roomId, callback) => {
        if (!db) {
            mockData.listeners['msg_' + roomId] = mockData.listeners['msg_' + roomId] || [];
            mockData.listeners['msg_' + roomId].push(callback);
            return { off: () => {
                const idx = mockData.listeners['msg_' + roomId].indexOf(callback);
                if(idx>-1) mockData.listeners['msg_' + roomId].splice(idx,1);
            }};
        }
        const ref = db.ref(`PrivateRooms/${roomId}/messages`);
        ref.on('child_added', (snapshot) => {
            callback(snapshot.key, snapshot.val());
        });
        return ref;
    },
    
    // 1:1 채팅방 정보 수신 (방폭 감지용)
    listenPrivateRoomInfo: (roomId, callback) => {
        if (!db) {
            mockData.listeners['info_' + roomId] = callback;
            return { off: () => { delete mockData.listeners['info_' + roomId]; }};
        }
        const ref = db.ref(`PrivateRooms/${roomId}/info`);
        ref.on('value', (snapshot) => {
            if(snapshot.exists()) callback(snapshot.val());
        });
        return ref;
    },

    // 1:1 방 나가기
    leavePrivateRoom: async (roomId, userId) => {
        if (!db) {
            if(mockData.listeners['info_' + roomId]) mockData.listeners['info_' + roomId]({ status: 'closed' });
            if(mockData.listeners.status && mockData.listeners.status[userId]) mockData.listeners.status[userId]({status:'idle'});
            return;
        }
        try {
            await db.ref(`PrivateRooms/${roomId}/info`).update({ status: 'closed' });
        } catch(e) {}
        try {
            await db.ref(`UserStatus/${userId}`).remove();
        } catch(e) {}
    }
};

// =============================================
// 🚨 서버 한도 초과 감지기
// Firebase에서 PERMISSION_DENIED 또는 quota 에러가 오면 팝업을 띄웁니다.
// =============================================
window._harinServerDownShown = false;

function _harinShowServerDownPopup() {
    if (window._harinServerDownShown) return;
    window._harinServerDownShown = true;

    // 팝업 컨테이너가 이미 있으면 표시
    const popup = document.getElementById('harin-server-down-popup');
    if (popup) {
        popup.classList.add('visible');
        return;
    }

    // 동적으로 팝업 생성 (HTML에 없을 경우 대비)
    const overlay = document.createElement('div');
    overlay.id = 'harin-server-down-popup';
    overlay.className = 'visible';
    overlay.innerHTML = `
        <div class="harin-server-down-box">
            <img src="assets/other/server_down.webp" alt="서버 다운 하린이" class="harin-server-down-img" />
            <h2 class="harin-server-down-title">서버 폭주로 하린이가 기절했습니다! 😭</h2>
            <p class="harin-server-down-msg">
                무료 서버가 오늘의 한도를 다 써버렸어요.<br>
                내일 아침 <strong>9시</strong>에 서버가 부활하면 다시 와주세요!
            </p>
            <div class="harin-server-down-timer" id="harin-revival-timer">부활까지 계산 중...</div>
            <button class="harin-server-down-btn" onclick="document.getElementById('harin-server-down-popup').classList.remove('visible'); window._harinServerDownShown = false;">
                그래도 둘러볼게요 👀
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    // 스타일 주입 (CSS 파일에 없을 경우 대비)
    if (!document.getElementById('harin-server-down-style')) {
        const style = document.createElement('style');
        style.id = 'harin-server-down-style';
        style.textContent = `
            #harin-server-down-popup {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(10, 5, 20, 0.88);
                backdrop-filter: blur(8px);
                align-items: center;
                justify-content: center;
            }
            #harin-server-down-popup.visible {
                display: flex;
                animation: harinFadeIn 0.4s ease;
            }
            @keyframes harinFadeIn {
                from { opacity: 0; transform: scale(0.92); }
                to   { opacity: 1; transform: scale(1); }
            }
            .harin-server-down-box {
                background: linear-gradient(135deg, #1a0a2e 0%, #0d0020 100%);
                border: 1px solid rgba(180, 120, 255, 0.35);
                border-radius: 24px;
                box-shadow: 0 0 60px rgba(150, 80, 255, 0.25), 0 20px 60px rgba(0,0,0,0.6);
                padding: 40px 32px 32px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                position: relative;
            }
            .harin-server-down-img {
                width: 180px;
                height: auto;
                border-radius: 16px;
                margin-bottom: 20px;
                box-shadow: 0 8px 32px rgba(150, 80, 255, 0.3);
                animation: harinFloat 3s ease-in-out infinite;
            }
            @keyframes harinFloat {
                0%, 100% { transform: translateY(0); }
                50%       { transform: translateY(-8px); }
            }
            .harin-server-down-title {
                font-size: 1.25rem;
                font-weight: 700;
                color: #f0d6ff;
                margin: 0 0 12px;
                line-height: 1.4;
            }
            .harin-server-down-msg {
                font-size: 0.95rem;
                color: #c9a8e8;
                line-height: 1.7;
                margin: 0 0 20px;
            }
            .harin-server-down-msg strong {
                color: #e879f9;
                font-size: 1.1em;
            }
            .harin-server-down-timer {
                background: rgba(150, 80, 255, 0.15);
                border: 1px solid rgba(150, 80, 255, 0.3);
                border-radius: 12px;
                padding: 10px 16px;
                font-size: 0.9rem;
                color: #d8b4fe;
                margin-bottom: 24px;
                font-variant-numeric: tabular-nums;
            }
            .harin-server-down-btn {
                background: linear-gradient(135deg, #7c3aed, #a855f7);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 0.95rem;
                font-weight: 600;
                padding: 12px 28px;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 20px rgba(150, 80, 255, 0.4);
            }
            .harin-server-down-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 28px rgba(150, 80, 255, 0.55);
            }
        `;
        document.head.appendChild(style);
    }

    // 부활 타이머 (다음 날 오전 9시까지 카운트다운)
    function updateRevivalTimer() {
        const now = new Date();
        const next9am = new Date();
        next9am.setHours(9, 0, 0, 0);
        if (now >= next9am) next9am.setDate(next9am.getDate() + 1);

        const diff = next9am - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const timerEl = document.getElementById('harin-revival-timer');
        if (timerEl) {
            timerEl.textContent = `🌅 부활까지 ${h}시간 ${m}분 ${s}초 남았어요`;
        }
    }
    updateRevivalTimer();
    setInterval(updateRevivalTimer, 1000);
}

// Firebase 에러 전역 감지 (db가 연결된 경우에만)
if (db) {
    // .info/connected 감지: 연결 끊김 탐지는 하되 팝업은 quota 에러에만
    db.ref('.info/serverTimeOffset').once('value').catch((err) => {
        if (err && (err.code === 'PERMISSION_DENIED' ||
                    (err.message && err.message.toLowerCase().includes('quota')))) {
            _harinShowServerDownPopup();
        }
    });

    // GlobalStats 읽기 실패 = 권한 에러 or quota 초과
    const _origGetInitialData = window.FirebaseAPI.getInitialData;
    window.FirebaseAPI.getInitialData = async function() {
        try {
            const result = await _origGetInitialData();
            return result;
        } catch(err) {
            if (err && (err.code === 'PERMISSION_DENIED' ||
                        (err.message && err.message.toLowerCase().includes('quota')))) {
                _harinShowServerDownPopup();
            }
            return defaultStats;
        }
    };
}

// GlobalStats 리스너에서 에러 감지
if (db) {
    const _origListen = window.FirebaseAPI.listenToGlobalStats;
    window.FirebaseAPI.listenToGlobalStats = function(callback) {
        if (!db) { _origListen(callback); return; }
        db.ref('GlobalStats').on('value',
            (snapshot) => { if(snapshot.exists()) callback(snapshot.val()); },
            (err) => {
                if (err && (err.code === 'PERMISSION_DENIED' ||
                            (err.message && err.message.toLowerCase().includes('quota')))) {
                    _harinShowServerDownPopup();
                }
            }
        );
    };
}

// window 전역에 수동 트리거 노출 (테스트용: window._harinShowServerDownPopup())
window._harinShowServerDownPopup = _harinShowServerDownPopup;

