// 사운드 매니저 (Voice 및 FX 통합 제어)
class SoundManager {
    constructor() {
        this.isMuted = localStorage.getItem('harin_sound_muted') === 'true';
        this.voices = {};
        this.voiceDir = 'assets/sounds/voices/';
        
        // preload
        this.mbtiList = [
            "intj", "intp", "entj", "entp", "infj", "infp", "enfj", "enfp",
            "istj", "isfj", "estj", "esfj", "istp", "isfp", "estp", "esfp"
        ];
        
        this.preloadVoices();
    }

    preloadVoices() {
        // MBTI Voices
        this.mbtiList.forEach(mbti => {
            const audio = new Audio(`${this.voiceDir}${mbti}.mp3`);
            audio.load();
            this.voices[mbti] = audio;
        });
        
        // Donation Voices
        this.voices['donate_normal'] = new Audio(`${this.voiceDir}donate_normal.mp3`);
        this.voices['donate_super'] = new Audio(`${this.voiceDir}donate_super.mp3`);
        this.voices['donate_normal'].volume = 0.4;
        this.voices['donate_super'].volume = 0.4;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('harin_sound_muted', this.isMuted);
        return this.isMuted;
    }

    // Voice 재생
    playVoice(key) {
        if (this.isMuted) return;
        if (this.voices[key]) {
            // 중복 재생 시 소리 겹치지 않게 처음으로 돌림
            this.voices[key].currentTime = 0;
            this.voices[key].play().catch(e => console.log('Audio play blocked:', e));
        }
    }

    // FX 재생 맵핑
    playClick() { if(!this.isMuted && window.soundFX) window.soundFX.playClick(); }
    playMbtiClick(type) { if(!this.isMuted && window.soundFX) window.soundFX.playMbtiClick(type); }
    playHover() { if(!this.isMuted && window.soundFX) window.soundFX.playHover(); }
    playAchievement() { if(!this.isMuted && window.soundFX) window.soundFX.playAchievement(); }
    playHiddenAchievement() { if(!this.isMuted && window.soundFX) window.soundFX.playHiddenAchievement(); }
    playCombo(count) { if(!this.isMuted && window.soundFX) window.soundFX.playCombo(count); }
    playDamage() { if(!this.isMuted && window.soundFX) window.soundFX.playDamage(); }
    playBuff() { if(!this.isMuted && window.soundFX) window.soundFX.playBuff(); }
    playShareBuff() { if(!this.isMuted && window.soundFX) window.soundFX.playShareBuff(); }
    playVictory() { if(!this.isMuted && window.soundFX) window.soundFX.playVictory(); }
    playDefeat() { if(!this.isMuted && window.soundFX) window.soundFX.playDefeat(); }
    playFever() { if(!this.isMuted && window.soundFX) window.soundFX.playFever(); }
    playGameStart() { if(!this.isMuted && window.soundFX) window.soundFX.playGameStart(); }
}

// 전역 등록
window.soundManager = new SoundManager();
