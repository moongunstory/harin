(function initSecurityUtils() {
    const MBTI_TYPES = new Set([
        'ENFJ', 'ENFP', 'ENTJ', 'ENTP',
        'ESFJ', 'ESFP', 'ESTJ', 'ESTP',
        'INFJ', 'INFP', 'INTJ', 'INTP',
        'ISFJ', 'ISFP', 'ISTJ', 'ISTP'
    ]);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function stripControls(value) {
        return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '');
    }

    function normalizeSpace(value) {
        return stripControls(value).replace(/\s+/g, ' ').trim();
    }

    function sanitizeNickname(value) {
        const normalized = normalizeSpace(value).replace(/[^0-9A-Za-z._\-가-힣 ]/g, '');
        const sliced = normalized.slice(0, 20);
        return sliced.length >= 2 ? sliced : '';
    }

    function sanitizeChatMessage(value, maxLen = 60) {
        return normalizeSpace(value).slice(0, maxLen);
    }

    function sanitizeBio(value, maxLen = 120) {
        return normalizeSpace(value).slice(0, maxLen);
    }

    function sanitizeAmountLabel(value) {
        const normalized = normalizeSpace(value).replace(/[^0-9A-Za-z$().,\- +]/g, '');
        return normalized.slice(0, 32);
    }

    function sanitizeUserId(value, { allowGuest = true } = {}) {
        const normalized = normalizeSpace(value);
        if (/^usr_[A-Za-z0-9_-]{8,64}$/.test(normalized)) return normalized;
        if (allowGuest && /^guest_[A-Za-z0-9_-]{6,64}$/.test(normalized)) return normalized;
        return '';
    }

    function sanitizeMbti(value) {
        const normalized = normalizeSpace(value).toUpperCase();
        return MBTI_TYPES.has(normalized) ? normalized : '';
    }

    function safeParseJson(raw, fallback) {
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function generateUserId(prefix = 'usr') {
        if (window.crypto?.randomUUID) {
            return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '')}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }

    function getStoredProfile() {
        const userId = sanitizeUserId(localStorage.getItem('mbti_userid'));
        const nickname = sanitizeNickname(localStorage.getItem('mbti_nickname'));
        const mbtiType = sanitizeMbti(localStorage.getItem('mbti_type'));
        const bio = sanitizeBio(localStorage.getItem('mbti_bio') || '', 40);
        const isGuest = userId.startsWith('guest_') || localStorage.getItem('mbti_nickname') === 'Guest';

        return {
            userId,
            nickname: isGuest ? 'Guest' : nickname,
            mbtiType: isGuest ? '' : mbtiType,
            bio,
            isGuest
        };
    }

    function persistProfile({ userId, nickname, mbtiType, bio = '', isGuest = false }) {
        const safeUserId = sanitizeUserId(userId, { allowGuest: true }) || generateUserId(isGuest ? 'guest' : 'usr');
        const safeNickname = isGuest ? 'Guest' : sanitizeNickname(nickname);
        const safeMbti = isGuest ? '' : sanitizeMbti(mbtiType);
        const safeBio = isGuest ? '' : sanitizeBio(bio, 40);

        localStorage.setItem('mbti_userid', safeUserId);
        localStorage.setItem('mbti_nickname', safeNickname || (isGuest ? 'Guest' : ''));
        localStorage.setItem('mbti_type', safeMbti);
        localStorage.setItem('mbti_bio', safeBio);

        return {
            userId: safeUserId,
            nickname: safeNickname || (isGuest ? 'Guest' : ''),
            mbtiType: safeMbti,
            bio: safeBio,
            isGuest
        };
    }

    function sanitizeFriend(friend) {
        return {
            id: sanitizeUserId(friend?.id, { allowGuest: false }),
            nickname: sanitizeNickname(friend?.nickname),
            mbti: sanitizeMbti(friend?.mbti || friend?.mbtiType || '')
        };
    }

    function getSafeArrayStorage(key, mapper) {
        const parsed = safeParseJson(localStorage.getItem(key) || '[]', []);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(mapper).filter(Boolean);
    }

    window.SecurityUtils = {
        MBTI_TYPES,
        escapeHtml,
        safeParseJson,
        sanitizeNickname,
        sanitizeChatMessage,
        sanitizeBio,
        sanitizeAmountLabel,
        sanitizeMbti,
        sanitizeUserId,
        sanitizeFriend,
        normalizeSpace,
        generateUserId,
        getStoredProfile,
        persistProfile,
        getSafeArrayStorage
    };
})();
