// 사운드 통합 매니저 (Voice mp3 + Web Audio FX 통합 제어)
class SoundManager {
    constructor() {
        this.isMuted = localStorage.getItem('harin_sound_muted') === 'true';
        // 음성 파일은 삭제됐으므로 voices 딕셔너리 비워둠
        this.voices = {};
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('harin_sound_muted', this.isMuted);
        return this.isMuted;
    }

    // 음성 파일 재생 (현재 비활성 - 파일 없음)
    playVoice(key) {
        if (this.isMuted) return;
        if (this.voices[key]) {
            this.voices[key].currentTime = 0;
            this.voices[key].play().catch(e => console.log('Audio play blocked:', e));
        }
    }

    // 효과음 래퍼 메서드 (SoundFX.js에 위임)
    playClick()            { if (!this.isMuted && window.soundFX) window.soundFX.playClick(); }
    playMbtiClick(type)    { if (!this.isMuted && window.soundFX) window.soundFX.playMbtiClick(type); }
    playHover()            { if (!this.isMuted && window.soundFX) window.soundFX.playHover(); }
    playAchievement()      { if (!this.isMuted && window.soundFX) window.soundFX.playAchievement(); }
    playHiddenAchievement(){ if (!this.isMuted && window.soundFX) window.soundFX.playHiddenAchievement(); }
    playCombo(count)       { if (!this.isMuted && window.soundFX) window.soundFX.playCombo(count); }
    playDamage()           { if (!this.isMuted && window.soundFX) window.soundFX.playDamage(); }
    playBuff()             { if (!this.isMuted && window.soundFX) window.soundFX.playBuff(); }
    playShareBuff()        { if (!this.isMuted && window.soundFX) window.soundFX.playShareBuff(); }
    playVictory()          { if (!this.isMuted && window.soundFX) window.soundFX.playVictory(); }
    playDefeat()           { if (!this.isMuted && window.soundFX) window.soundFX.playDefeat(); }
    playFever()            { if (!this.isMuted && window.soundFX) window.soundFX.playFever(); }
    playGameStart()        { if (!this.isMuted && window.soundFX) window.soundFX.playGameStart(); }
}

// 전역 등록
window.soundManager = new SoundManager();
