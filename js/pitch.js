/**
 * ============================================================
 * pitch.js — Detecção de Pitch e Conversão Musical
 * ============================================================
 * Implementa o algoritmo YIN para detecção de frequência fundamental.
 * Converte frequência em nota musical (pt-BR), oitava e cents.
 * Inclui suavização temporal e gate de confiança.
 *
 * Algoritmo YIN:
 *   1. Função de diferença d(τ)
 *   2. Normalização cumulativa (CMND)
 *   3. Busca de limiar absoluto
 *   4. Interpolação parabólica
 *   5. Conversão: f = sampleRate / τ_interpolado
 *
 * Referência:
 *   de Cheveigné, A., & Kawahara, H. (2002).
 *   "YIN, a fundamental frequency estimator for speech and music."
 *   JASA, 111(4), 1917-1930.
 * ============================================================
 */

class PitchDetector {
  constructor() {
    // ---- Configuração do YIN ----
    this.yinThreshold = 0.15;       // Limiar CMND (menor = mais seletivo)
    this.minFrequency = 60;         // Hz — limite inferior (≈ B1)
    this.maxFrequency = 1500;       // Hz — limite superior (≈ F#6)

    // ---- Referência de afinação ----
    this.referenceA4 = 440;         // Hz — configurável pelo usuário

    this.noteNamesSharps = [
      'Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá',
      'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'
    ];

    this.noteNamesFlats = [
      'Dó', 'Réb', 'Ré', 'Mib', 'Mi', 'Fá',
      'Solb', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'
    ];

    this.accidentalMode = 'sharps';

    this.noiseFloor = 0.008;        
    this.calibratedNoise = null;    

    this.sensitivityPresets = {
      low:    { rmsThreshold: 0.020, yinThreshold: 0.10, stabilityFrames: 5 },
      medium: { rmsThreshold: 0.010, yinThreshold: 0.15, stabilityFrames: 3 },
      high:   { rmsThreshold: 0.005, yinThreshold: 0.20, stabilityFrames: 2 }
    };
    this.sensitivity = 'low';
    
    this.historySize = 5;          

    this.frequencyHistory = [];

    // ---- Estabilidade ----
    this.lastStableNote = null;     // Última nota exibida
    this.lastStableFreq = 0;
    this.stabilityCounter = 0;
    this.hysteresisCents = 50;      // Cents mínimos para mudar de nota

    // ---- Buffers YIN reutilizáveis (inicializados no primeiro uso) ----
    /** @type {Float32Array|null} */
    this._yinBuffer = null;
  }

  // ================================================================
  //  ALGORITMO YIN
  // ================================================================

  /**
   * Detecta a frequência fundamental usando o algoritmo YIN.
   * @param {Float32Array} buffer - Amostras de áudio [-1, 1]
   * @param {number} sampleRate - Taxa de amostragem em Hz
   * @returns {{ frequency: number, confidence: number }|null}
   *          frequency em Hz, confidence [0, 1] (1 = máxima confiança)
   */
  detectPitch(buffer, sampleRate) {
    if (!buffer || buffer.length === 0) return null;

    const halfLen = Math.floor(buffer.length / 2);

    // Limites de lag baseados na faixa de frequência
    const minLag = Math.floor(sampleRate / this.maxFrequency);
    const maxLag = Math.min(Math.floor(sampleRate / this.minFrequency), halfLen);

    if (maxLag <= minLag) return null;

    // Alocar ou reutilizar buffer YIN
    if (!this._yinBuffer || this._yinBuffer.length < halfLen) {
      this._yinBuffer = new Float32Array(halfLen);
    }

    const yinBuf = this._yinBuffer;

    // ------- Passo 1: Função de diferença d(τ) -------
    // d(τ) = Σ (x[j] - x[j + τ])²
    yinBuf[0] = 0;
    for (let tau = 1; tau < halfLen; tau++) {
      let sum = 0;
      for (let j = 0; j < halfLen; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      yinBuf[tau] = sum;
    }

    // ------- Passo 2: Normalização cumulativa (CMND) -------
    // d'(τ) = d(τ) / [ (1/τ) × Σ_{j=1}^{τ} d(j) ]
    yinBuf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfLen; tau++) {
      runningSum += yinBuf[tau];
      yinBuf[tau] = (runningSum === 0) ? 1 : yinBuf[tau] * tau / runningSum;
    }

    // ------- Passo 3: Busca de limiar absoluto -------
    // Encontrar o primeiro τ onde CMND cai abaixo do threshold
    const threshold = this._getYinThreshold();
    let bestTau = -1;

    for (let tau = minLag; tau < maxLag; tau++) {
      if (yinBuf[tau] < threshold) {
        // Encontrar o vale local (mínimo) a partir daqui
        while (tau + 1 < maxLag && yinBuf[tau + 1] < yinBuf[tau]) {
          tau++;
        }
        bestTau = tau;
        break;
      }
    }

    // Se não encontrou um vale abaixo do threshold, buscar mínimo global como fallback
    if (bestTau === -1) {
      let minVal = Infinity;
      for (let tau = minLag; tau < maxLag; tau++) {
        if (yinBuf[tau] < minVal) {
          minVal = yinBuf[tau];
          bestTau = tau;
        }
      }
      // Se o mínimo global ainda é alto, não é confiável
      if (minVal > 0.5) return null;
    }

    // ------- Passo 4: Interpolação parabólica -------
    const refinedTau = this._parabolicInterpolation(yinBuf, bestTau, halfLen);

    // ------- Passo 5: Frequência e confiança -------
    const frequency = sampleRate / refinedTau;
    const confidence = 1 - yinBuf[bestTau]; // CMND baixo = alta confiança

    // Validar faixa
    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return null;
    }

    return { frequency, confidence };
  }

  /**
   * Interpolação parabólica para refinar a posição do mínimo.
   * @private
   */
  _parabolicInterpolation(yinBuf, tau, bufLen) {
    if (tau <= 0 || tau >= bufLen - 1) return tau;

    const s0 = yinBuf[tau - 1];
    const s1 = yinBuf[tau];
    const s2 = yinBuf[tau + 1];

    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) < 1e-12) return tau;

    const adjustment = (s2 - s0) / denom;
    return tau + adjustment;
  }

  /**
   * Retorna o threshold YIN baseado na sensibilidade.
   * @private
   */
  _getYinThreshold() {
    const preset = this.sensitivityPresets[this.sensitivity];
    return preset ? preset.yinThreshold : this.yinThreshold;
  }

  // ================================================================
  //  GATE DE RUÍDO
  // ================================================================

  /**
   * Verifica se o sinal está acima do nível de ruído.
   * @param {number} rms - Nível RMS do sinal
   * @returns {boolean}
   */
  isSignalAboveNoise(rms) {
    const preset = this.sensitivityPresets[this.sensitivity];
    const baseThreshold = preset ? preset.rmsThreshold : this.noiseFloor;

    // Se calibrado, usar nível calibrado + margem
    if (this.calibratedNoise !== null) {
      return rms > this.calibratedNoise * 2.5;
    }

    return rms > baseThreshold;
  }

  /**
   * Define o nível de ruído calibrado.
   * @param {number} noiseRMS - Nível RMS medido durante calibração
   */
  setCalibration(noiseRMS) {
    this.calibratedNoise = noiseRMS;
  }

  /**
   * Remove a calibração.
   */
  clearCalibration() {
    this.calibratedNoise = null;
  }

  // ================================================================
  //  SUAVIZAÇÃO E ESTABILIDADE
  // ================================================================

  /**
   * Processa a frequência com suavização e estabilidade.
   * Retorna a nota suavizada ou null se instável.
   * @param {number} rawFrequency - Frequência bruta do YIN
   * @param {number} confidence - Confiança do YIN [0, 1]
   * @returns {{ frequency: number, note: object }|null}
   */
  processFrequency(rawFrequency, confidence) {
    if (!rawFrequency || rawFrequency <= 0) {
      this.frequencyHistory = [];
      this.stabilityCounter = 0;
      return null;
    }

    // Adicionar ao histórico
    this.frequencyHistory.push(rawFrequency);
    if (this.frequencyHistory.length > this.historySize) {
      this.frequencyHistory.shift();
    }

    // Mediana das últimas leituras
    const smoothedFreq = this._median(this.frequencyHistory);

    // Converter para nota
    const noteInfo = this.frequencyToNote(smoothedFreq);

    // Verificar estabilidade
    const preset = this.sensitivityPresets[this.sensitivity];
    const requiredFrames = preset ? preset.stabilityFrames : 3;

    if (this.lastStableNote === null ||
        this._noteChanged(noteInfo, this.lastStableNote, this.lastStableFreq, smoothedFreq)) {
      this.stabilityCounter++;
      if (this.stabilityCounter >= requiredFrames) {
        this.lastStableNote = noteInfo;
        this.lastStableFreq = smoothedFreq;
        this.stabilityCounter = 0;
      }
    } else {
      this.stabilityCounter = 0;
      this.lastStableFreq = smoothedFreq; // Atualizar freq mesmo sem mudança de nota
    }

    if (this.lastStableNote === null) return null;

    // Recalcular cents com a frequência suavizada atual
    const updatedNote = this.frequencyToNote(smoothedFreq);

    return {
      frequency: smoothedFreq,
      note: {
        ...this.lastStableNote,
        cents: updatedNote.cents,
        idealFrequency: this.lastStableNote.idealFrequency
      }
    };
  }

  /**
   * Verifica se a nota mudou significativamente.
   * @private
   */
  _noteChanged(newNote, oldNote, oldFreq, newFreq) {
    if (!oldNote) return true;
    if (newNote.midi !== oldNote.midi) {
      // Verificar histerese: a diferença em cents deve ser suficiente
      const centsDiff = Math.abs(1200 * Math.log2(newFreq / oldFreq));
      return centsDiff > this.hysteresisCents;
    }
    return false;
  }

  /**
   * Calcula a mediana de um array.
   * @private
   */
  _median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Reseta o estado de suavização (útil ao parar/reiniciar).
   */
  resetSmoothing() {
    this.frequencyHistory = [];
    this.lastStableNote = null;
    this.lastStableFreq = 0;
    this.stabilityCounter = 0;
  }

  // ================================================================
  //  CONVERSÃO FREQUÊNCIA → NOTA MUSICAL
  // ================================================================

  /**
   * Converte uma frequência em nota musical.
   * @param {number} frequency - Frequência em Hz
   * @returns {{
   *   name: string,        // Ex: "Lá"
   *   fullName: string,    // Ex: "Lá4"
   *   octave: number,      // Ex: 4
   *   midi: number,        // Ex: 69
   *   cents: number,       // Ex: -2
   *   idealFrequency: number, // Ex: 440.0
   *   frequency: number    // Ex: 438.7
   * }}
   */
  frequencyToNote(frequency) {
    // MIDI = 69 + 12 × log2(f / A4)
    const midiExact = 69 + 12 * Math.log2(frequency / this.referenceA4);
    const midiRounded = Math.round(midiExact);

    // Nota e oitava
    const noteIndex = ((midiRounded % 12) + 12) % 12; // Garantir positivo
    const octave = Math.floor(midiRounded / 12) - 1;

    // Nome da nota
    const noteNames = this.accidentalMode === 'flats'
      ? this.noteNamesFlats
      : this.noteNamesSharps;
    const name = noteNames[noteIndex];

    // Frequência ideal da nota
    const idealFrequency = this.referenceA4 * Math.pow(2, (midiRounded - 69) / 12);

    // Diferença em cents
    const cents = Math.round(1200 * Math.log2(frequency / idealFrequency));

    return {
      name,
      fullName: `${name}${octave}`,
      octave,
      midi: midiRounded,
      cents,
      idealFrequency: Math.round(idealFrequency * 10) / 10,
      frequency: Math.round(frequency * 10) / 10
    };
  }

  /**
   * Calcula o período de uma frequência.
   * @param {number} frequency - Frequência em Hz
   * @returns {number} Período em milissegundos
   */
  frequencyToPeriod(frequency) {
    if (frequency <= 0) return 0;
    return (1 / frequency) * 1000; // ms
  }

  /**
   * Calcula a frequência da oitava abaixo.
   * @param {number} frequency - Frequência em Hz
   * @returns {number}
   */
  octaveBelow(frequency) {
    return frequency / 2;
  }

  /**
   * Calcula a frequência da oitava acima.
   * @param {number} frequency - Frequência em Hz
   * @returns {number}
   */
  octaveAbove(frequency) {
    return frequency * 2;
  }

  // ================================================================
  //  CONFIGURAÇÃO
  // ================================================================

  /**
   * Define a sensibilidade.
   * @param {'low'|'medium'|'high'} level
   */
  setSensitivity(level) {
    if (this.sensitivityPresets[level]) {
      this.sensitivity = level;
      this.resetSmoothing();
    }
  }

  /**
   * Define a frequência de referência A4.
   * @param {number} freq - Frequência em Hz (ex: 440, 432, 442)
   */
  setReferenceA4(freq) {
    if (freq > 400 && freq < 500) {
      this.referenceA4 = freq;
    }
  }

  /**
   * Define o modo de acidentes (sustenidos ou bemóis).
   * @param {'sharps'|'flats'} mode
   */
  setAccidentalMode(mode) {
    if (mode === 'sharps' || mode === 'flats') {
      this.accidentalMode = mode;
    }
  }
}
