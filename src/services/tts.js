class TtsEngine {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  }

  setDuckingCallbacks(onStart, onEnd) {
    this.onSpeechStart = onStart;
    this.onSpeechEnd = onEnd;
  }

  // Format number sequence to Indonesian spoken phrase
  // e.g. "A-012" -> "A, nol, satu, dua"
  formatTicketForSpeech(ticketNumber) {
    if (!ticketNumber) return '';
    const parts = ticketNumber.split('-');
    const prefix = parts[0] ? parts[0].toUpperCase() : '';
    const numDigits = parts[1] ? parts[1].split('').map(d => {
      switch(d) {
        case '0': return 'nol';
        case '1': return 'satu';
        case '2': return 'dua';
        case '3': return 'tiga';
        case '4': return 'empat';
        case '5': return 'lima';
        case '6': return 'enam';
        case '7': return 'tujuh';
        case '8': return 'delapan';
        case '9': return 'sembilan';
        default: return d;
      }
    }).join(' ') : '';

    return `${prefix} ${numDigits}`;
  }

  speakCall(ticket, counterName, clinicName) {
    const spokenNum = this.formatTicketForSpeech(ticket.ticketNumber);
    const destination = counterName || clinicName || 'Loket';
    const text = `Nomor antrean, ${spokenNum}, ke, ${destination}`;

    this.queue.push({ text, ticket });
    this.processQueue();
  }

  processQueue() {
    if (this.speaking || this.queue.length === 0 || !this.synth) return;

    this.speaking = true;
    const item = this.queue.shift();

    if (this.onSpeechStart) this.onSpeechStart();

    // Play initial bell chime sound via Web Audio API synthesizer
    this.playChime(() => {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.9; // Slightly calm pace
      utterance.pitch = 1.0;

      // Select Indonesian voice if available
      const voices = this.synth.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
      if (idVoice) utterance.voice = idVoice;

      utterance.onend = () => {
        this.speaking = false;
        if (this.onSpeechEnd) this.onSpeechEnd();
        // Process next item in queue after short pause (U02 requirement)
        setTimeout(() => this.processQueue(), 500);
      };

      utterance.onerror = (err) => {
        console.warn('TTS utterance error:', err);
        this.speaking = false;
        if (this.onSpeechEnd) this.onSpeechEnd();
        setTimeout(() => this.processQueue(), 500);
      };

      this.synth.speak(utterance);
    });
  }

  playChime(callback) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        if (callback) callback();
        return;
      }
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // High ding-dong chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.setValueAtTime(523.25, now + 0.3); // C5

      osc2.frequency.setValueAtTime(1318.5, now);
      osc2.frequency.setValueAtTime(1046.5, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);

      setTimeout(() => {
        if (callback) callback();
      }, 750);
    } catch (e) {
      console.warn('Audio chime failed:', e);
      if (callback) callback();
    }
  }
}

export const ttsEngine = new TtsEngine();
