/**
 * ============================================================
 * audio.js — Módulo de Captura de Áudio
 * ============================================================
 * Gerencia o acesso ao microfone via Web Audio API.
 * Fornece dados de domínio do tempo (waveform) e frequência (FFT),
 * além de métricas de nível (RMS, peak, clipping).
 *
 * Estados:
 *   'idle'        → Microfone desligado
 *   'requesting'  → Solicitando permissão
 *   'active'      → Microfone ativo
 *   'denied'      → Permissão negada
 *   'error'       → Erro no dispositivo
 * ============================================================
 */

class AudioCapture {
  constructor() {
    /** @type {'idle'|'requesting'|'active'|'denied'|'error'} */
    this.state = 'idle';

    /** @type {AudioContext|null} */
    this.audioCtx = null;

    /** @type {AnalyserNode|null} */
    this.analyser = null;

    /** @type {MediaStream|null} */
    this.stream = null;

    /** @type {MediaStreamAudioSourceNode|null} */
    this.sourceNode = null;

    // Configuração do AnalyserNode
    this.fftSize = 4096;         // Boa resolução para pitch e FFT
    this.smoothingTimeConstant = 0.6;

    // Buffers reutilizáveis (criados ao iniciar)
    /** @type {Float32Array|null} */
    this.timeDomainBuffer = null;

    /** @type {Float32Array|null} */
    this.frequencyBuffer = null;

    // Callback de mudança de estado
    /** @type {function|null} */
    this.onStateChange = null;
  }

  /**
   * Inicia a captura de áudio do microfone.
   * @returns {Promise<boolean>} true se iniciou com sucesso
   */
  async start() {
    if (this.state === 'active') return true;

    this._setState('requesting');

    try {
      // Solicitar acesso ao microfone
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Criar AudioContext
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Criar AnalyserNode
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;

      // Conectar microfone → analyser
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);

      // Criar buffers reutilizáveis
      this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
      this.frequencyBuffer = new Float32Array(this.analyser.frequencyBinCount);

      this._setState('active');
      return true;

    } catch (err) {
      console.error('[AudioCapture] Erro ao acessar microfone:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this._setState('denied');
      } else {
        this._setState('error');
      }
      return false;
    }
  }

  /**
   * Para a captura de áudio e libera recursos.
   */
  stop() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.analyser = null;
    this.timeDomainBuffer = null;
    this.frequencyBuffer = null;

    this._setState('idle');
  }

  /**
   * Preenche o buffer de domínio do tempo (waveform).
   * @returns {Float32Array|null} Buffer com amostras [-1, 1]
   */
  getTimeDomainData() {
    if (!this.analyser || !this.timeDomainBuffer) return null;
    this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);
    return this.timeDomainBuffer;
  }

  /**
   * Preenche o buffer de frequência (FFT em dB).
   * @returns {Float32Array|null} Buffer com magnitude em dB
   */
  getFrequencyData() {
    if (!this.analyser || !this.frequencyBuffer) return null;
    this.analyser.getFloatFrequencyData(this.frequencyBuffer);
    return this.frequencyBuffer;
  }

  /**
   * Calcula o nível RMS do sinal atual.
   * @param {Float32Array} buffer - Dados de domínio do tempo
   * @returns {number} Valor RMS [0, 1]
   */
  calculateRMS(buffer) {
    if (!buffer || buffer.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Calcula o pico absoluto do sinal.
   * @param {Float32Array} buffer - Dados de domínio do tempo
   * @returns {number} Valor de pico [0, 1]
   */
  calculatePeak(buffer) {
    if (!buffer || buffer.length === 0) return 0;

    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  /**
   * Verifica se o sinal está em clipping (saturação).
   * @param {Float32Array} buffer - Dados de domínio do tempo
   * @param {number} threshold - Limiar de clipping (padrão 0.98)
   * @returns {boolean}
   */
  isClipping(buffer, threshold = 0.98) {
    if (!buffer) return false;

    let clipCount = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) >= threshold) {
        clipCount++;
        if (clipCount > 3) return true; // Mais de 3 amostras = clipping real
      }
    }
    return false;
  }

  /**
   * Retorna a taxa de amostragem do áudio.
   * @returns {number} Sample rate em Hz
   */
  get sampleRate() {
    return this.audioCtx ? this.audioCtx.sampleRate : 44100;
  }

  /**
   * Retorna se o microfone está ativo.
   * @returns {boolean}
   */
  get isActive() {
    return this.state === 'active';
  }

  /**
   * Atualiza o estado e notifica callback.
   * @private
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;
    if (this.onStateChange && oldState !== newState) {
      this.onStateChange(newState, oldState);
    }
  }
}
