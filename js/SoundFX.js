// Web Audio API를 사용한 게임 효과음 라이브러리
class SoundFX {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playOscillator(type, frequency, duration, volume = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playClick() {
        this.playOscillator('sine', 800, 0.1, 0.05);
    }

    playMbtiClick(type) {
        switch (type) {
            case 'E': this.playOscillator('sine',     1200, 0.15, 0.1);  break;
            case 'I': this.playOscillator('triangle',  400, 0.2,  0.1);  break;
            case 'S': this.playOscillator('square',    600, 0.08, 0.05); break;
            case 'N': this.playOscillator('sine',      900, 0.25, 0.08); break;
            case 'T': this.playOscillator('sawtooth',  750, 0.05, 0.075);break;
            case 'F': this.playOscillator('triangle',  650, 0.2,  0.1);  break;
            case 'J': this.playOscillator('square',    800, 0.1,  0.06); break;
            case 'P': this.playOscillator('sine',     1000, 0.15, 0.08); break;
            default:  this.playOscillator('sine',      800, 0.1,  0.05);
        }
    }

    playHover() {
        this.playOscillator('sine', 1200, 0.05, 0.02);
    }

    playAchievement() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440,    now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(880,    now + 0.3);

        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playHiddenAchievement() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.type = 'square';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(523.25,  now);
        osc2.frequency.setValueAtTime(1046.50, now);
        osc1.frequency.setValueAtTime(659.25,  now + 0.1);
        osc2.frequency.setValueAtTime(1318.51, now + 0.1);
        osc1.frequency.setValueAtTime(783.99,  now + 0.2);
        osc2.frequency.setValueAtTime(1567.98, now + 0.2);
        osc1.frequency.setValueAtTime(1046.50, now + 0.3);
        osc2.frequency.setValueAtTime(2093.00, now + 0.3);

        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(now); osc2.start(now);
        osc1.stop(now + 1.2); osc2.stop(now + 1.2);
    }

    playCombo(comboCount) {
        const baseFreq = 300;
        const addFreq = Math.min(comboCount * 50, 1000);
        this.playOscillator('triangle', baseFreq + addFreq, 0.2, 0.1);
    }

    playDamage() {
        this.playOscillator('sawtooth', 150, 0.2, 0.1);
    }

    playBuff() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.5);

        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.linearRampToValueAtTime(0.0, now + 0.5);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playShareBuff() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;

        const melody = [
            [261.63, 0.0],  [329.63, 0.18], [392.00, 0.36],
            [523.25, 0.54], [659.25, 0.72], [783.99, 0.90],
            [1046.5, 1.08],
        ];

        melody.forEach(([freq, t]) => {
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + t);
            gain.gain.setValueAtTime(0.0, now + t);
            gain.gain.linearRampToValueAtTime(0.12, now + t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + t);
            osc.stop(now + t + 0.45);
        });

        [2093, 2637, 3136].forEach((freq, i) => {
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + 1.2 + i * 0.15);
            gain.gain.setValueAtTime(0.0, now + 1.2 + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.06, now + 1.2 + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + i * 0.15 + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + 1.2 + i * 0.15);
            osc.stop(now + 1.2 + i * 0.15 + 0.65);
        });

        const base     = this.ctx.createOscillator();
        const baseGain = this.ctx.createGain();
        base.type = 'sine';
        base.frequency.setValueAtTime(130.81, now);
        baseGain.gain.setValueAtTime(0.0, now);
        baseGain.gain.linearRampToValueAtTime(0.08, now + 0.2);
        baseGain.gain.setValueAtTime(0.08, now + 1.8);
        baseGain.gain.linearRampToValueAtTime(0.0, now + 2.5);
        base.connect(baseGain);
        baseGain.connect(this.ctx.destination);
        base.start(now);
        base.stop(now + 2.5);
    }

    playFever() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;

        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
            const osc      = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);

            gainNode.gain.setValueAtTime(0, now + idx * 0.1);
            gainNode.gain.linearRampToValueAtTime(0.08, now + idx * 0.1 + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.35);
        });
    }

    playVictory() {
        this.playAchievement();
    }

    playDefeat() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now      = this.ctx.currentTime;
        const osc      = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);

        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0.0, now + 1.0);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
    }

    playGameStart() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now      = this.ctx.currentTime;
        const drum     = this.ctx.createOscillator();
        const drumGain = this.ctx.createGain();

        drum.type = 'square';
        drum.frequency.setValueAtTime(100, now);
        drumGain.gain.setValueAtTime(0.1, now);
        drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        drum.connect(drumGain);
        drumGain.connect(this.ctx.destination);
        drum.start(now);
        drum.stop(now + 0.5);

        setTimeout(() => {
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + 0.5 + i * 0.1);
                gain.gain.setValueAtTime(0.08, now + 0.5 + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.1 + 0.3);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + 0.5 + i * 0.1);
                osc.stop(now + 0.5 + i * 0.1 + 0.3);
            });
        }, 500);
    }
}

// 전역 등록
window.soundFX = new SoundFX();
