/**
 * firebase.js
 * Firebase 연동 및 데이터 처리
 */

// TODO: 본인의 Firebase 프로젝트의 Config 객체로 반드시 교체하세요.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
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
            const snapshot = await db.ref('GlobalStats').once('value');
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                await db.ref('GlobalStats').set(defaultStats);
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
        if (!snapshot.exists()) {
            userRef.set({
                nickname: nickname,
                mbti_type: mbtiType || '',
                total_clicks: 0,
                clicks: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        } else {
            // 이미 있으면 닉네임/MBTI만 업데이트
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
        if (!userId || nickname === 'Guest') return;
        if (!nickname || !text) return;
        
        if (!db) {
            // Mock 모드 동작
            const msg = {
                userId, nickname, mbtiType: mbtiType || '', text,
                timestamp: Date.now()
            };
            mockData.listeners.global.forEach(cb => cb('mock_' + Date.now() + Math.random(), msg));
            return;
        }

        const chatRef = db.ref('GlobalChat').push();
        chatRef.set({
            userId, nickname, mbtiType: mbtiType || '', text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
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
