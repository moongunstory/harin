# Security Review

## Summary

- This project is a static frontend with Firebase Realtime Database usage.
- I did not find server-side SQL query code or local file include logic in this repo, so classic `SQL Injection` and `LFI` are not directly present in the checked source.
- The main practical risks are:
  - stored/reflected XSS through user-controlled nickname/message/profile values
  - `localStorage` identity tampering
  - forged writes to Firebase if database rules are weak
  - client-side trust of ranking, profile, and match state

## Findings

### 1. Client-only identity can be forged

The app stores user identity in `localStorage` (`mbti_userid`, `mbti_nickname`, `mbti_type`) and then uses those values for chat, ranking, profile, and game writes.

Impact:
- Anyone can open DevTools and impersonate another user
- match/chat/profile writes can be forged
- rankings and records can be manipulated

Status:
- Partially hardened in code by validating and normalizing IDs, nicknames, MBTI, bio, and messages before use
- Not fully solvable on the client alone

Required final fix:
- Enable Firebase Authentication
- Enforce Firebase Realtime Database Security Rules so users can only write their own records
- Never trust client-provided `userId` as authority

### 2. XSS risk from `innerHTML` with user-controlled fields

Several screens render nickname/message/profile-related values into HTML. This is the highest code-level issue in the current frontend.

Impact:
- malicious nickname or chat content can execute script in another user session
- stolen local data, forged actions, UI takeover

Status:
- Added `js/security.js`
- Sanitized nickname/chat/profile inputs and key Firebase writes
- Hardened chat rendering path and profile bootstrap path
- Added CSP meta policy to reduce script injection surface

Remaining work recommended:
- Continue replacing `innerHTML` + inline `onclick` patterns with `textContent` + `addEventListener`
- Review `profile.js`, `ui.js`, and large inline scripts in `donate.html` for full DOM-safe rendering migration

### 3. Firebase write abuse depends on rules

The frontend writes directly to paths such as:
- `Users/*`
- `GlobalChat`
- `PrivateRooms/*`
- `MatchQueue`
- `UserStatus/*`
- `makgoraStats/*`
- `makgoraHistory/*`

Impact:
- if Firebase rules are open or weak, attackers can overwrite records, spam chats, forge rankings, and read private room data

Status:
- Client-side validation added for multiple write paths
- Still incomplete unless server-side rules are enforced

Required final fix:
- lock each path with auth-based ownership checks
- validate field length/type server-side in Firebase Rules
- deny arbitrary room access and arbitrary profile overwrite

## Changes Applied

- Added [`js/security.js`](C:\Users\moong\Desktop\harin\web\js\security.js)
- Added input normalization for:
  - nickname
  - chat message
  - bio
  - MBTI
  - user ID
- Updated:
  - [`js/main.js`](C:\Users\moong\Desktop\harin\web\js\main.js)
  - [`js/chat.js`](C:\Users\moong\Desktop\harin\web\js\chat.js)
  - [`js/firebase.js`](C:\Users\moong\Desktop\harin\web\js\firebase.js)
- Added CSP/referrer policy meta tags to:
  - [`index.html`](C:\Users\moong\Desktop\harin\web\index.html)
  - [`donate.html`](C:\Users\moong\Desktop\harin\web\donate.html)

## Must-Do Next

1. Add Firebase Authentication.
2. Apply strict Firebase Realtime Database Rules.
3. Remove remaining user-data `innerHTML` render paths.
4. Replace inline event handlers with JS event listeners.
5. Add write-rate limiting / anti-spam on chat and matchmaking.
