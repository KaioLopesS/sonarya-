/**
 * ============================================================
 * visualizer.js — Visualização de Áudio (Canvas)
 * ============================================================
 * Renderiza:
 *   1. Forma de onda (osciloscópio) — domínio do tempo
 *   2. Espectro de frequências (FFT) — domínio da frequência
 *
 * Usa Canvas 2D com requestAnimationFrame.
 * Remove nível DC da waveform.
 * Destaca a frequência fundamental no espectro.
 * Suporta congelar/descongelar.
 * Responsivo via ResizeObserver.
 * ============================================================
 */

class AudioVisualizer {
  /**
   * @param {HTMLCanvasElement} waveCanvas - Canvas para waveform
   * @param {HTMLCanvasElement} fftCanvas - Canvas para espectro FFT
   */
  constructor(waveCanvas, fftCanvas) {
    // Canvas e contextos
    this.waveCanvas = waveCanvas;
    this.fftCanvas = fftCanvas;
    this.waveCtx = waveCanvas.getContext('2d');
    this.fftCtx = fftCanvas.getContext('2d');

    // Estado
    this.frozen = false;

    // Configuração visual — tema claro (fundo branco, azul acadêmico)
    this.waveColor = '#2563eb';
    this.waveBgColor = '#ffffff';
    this.waveGridColor = 'rgba(0, 0, 0, 0.05)';
    this.fftBarColor = '#2563eb';
    this.fftBgColor = '#ffffff';
    this.fftGridColor = 'rgba(0, 0, 0, 0.05)';
    this.fundamentalColor = '#1d4ed8';
    this.textColor = 'rgba(71, 85, 105, 0.85)';
    this.lineWidth = 1.4;

    // Faixa de frequência para o espectro
    this.fftMaxFreq = 1200;    // Hz — limite superior exibido

    // DPI scaling
    this.dpr = window.devicePixelRatio || 1;

    // Configurar dimensões iniciais
    this._setupCanvas(this.waveCanvas);
    this._setupCanvas(this.fftCanvas);

    // ResizeObserver para responsividade
    this._resizeObserver = new ResizeObserver(() => {
      if (!this.frozen) {
        this._setupCanvas(this.waveCanvas);
        this._setupCanvas(this.fftCanvas);
      }
    });
    this._resizeObserver.observe(this.waveCanvas.parentElement);
    this._resizeObserver.observe(this.fftCanvas.parentElement);
  }

  /**
   * Configura o canvas para alta resolução (DPI scaling).
   * @private
   */
  _setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ================================================================
  //  WAVEFORM (OSCILOSCÓPIO)
  // ================================================================

  /**
   * Desenha a forma de onda.
   * @param {Float32Array} buffer - Dados de domínio do tempo
   */
  drawWaveform(buffer) {
    if (this.frozen) return;

    const canvas = this.waveCanvas;
    const ctx = this.waveCtx;
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    // Limpar
    ctx.fillStyle = this.waveBgColor;
    ctx.fillRect(0, 0, width, height);

    // Grade
    this._drawWaveGrid(ctx, width, height);

    if (!buffer || buffer.length === 0) {
      this._drawCenterLine(ctx, width, height);
      return;
    }

    // Remover DC offset e encontrar pico
    let dcSum = 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      dcSum += buffer[i];
    }
    const dcOffset = dcSum / buffer.length;

    for (let i = 0; i < buffer.length; i++) {
      const val = Math.abs(buffer[i] - dcOffset);
      if (val > peak) peak = val;
    }

    // Auto-escala: normalizar para que o pico ocupe ~80% da altura
    // Com ganho mínimo e máximo para evitar amplificar ruído ou clippar
    const targetFill = 0.40; // Cada lado ocupa 40% da altura (80% total)
    const minGain = 1;       // Não reduzir abaixo de 1x
    const maxGain = 200;     // Não amplificar demais (evita ruído gigante)

    let gain;
    if (peak < 0.001) {
      gain = minGain; // Silêncio — não amplificar
    } else {
      gain = (height * targetFill) / peak;
      gain = Math.max(minGain, Math.min(maxGain, gain));
    }

    // Suavizar transições de ganho para evitar saltos bruscos
    if (!this._lastWaveGain) this._lastWaveGain = gain;
    const smoothing = 0.15;
    this._lastWaveGain = this._lastWaveGain + (gain - this._lastWaveGain) * smoothing;
    const smoothGain = this._lastWaveGain;

    // Desenhar onda
    ctx.beginPath();
    ctx.strokeStyle = this.waveColor;
    ctx.lineWidth = this.lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Usar um subconjunto do buffer para performance
    const drawSamples = Math.min(buffer.length, 1024);
    const step = buffer.length / drawSamples;
    const midY = height / 2;

    for (let i = 0; i < drawSamples; i++) {
      const sampleIndex = Math.floor(i * step);
      const sample = buffer[sampleIndex] - dcOffset;
      const x = (i / drawSamples) * width;
      const y = midY - sample * smoothGain;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Glow sutil
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = this.waveColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = this.lineWidth;
  }

  /**
   * Desenha a grade de referência da waveform.
   * @private
   */
  _drawWaveGrid(ctx, width, height) {
    ctx.strokeStyle = this.waveGridColor;
    ctx.lineWidth = 1;

    // Linha central
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Linhas horizontais ±0.5
    const positions = [0.25, 0.75];
    ctx.setLineDash([4, 6]);
    for (const pos of positions) {
      ctx.beginPath();
      ctx.moveTo(0, height * pos);
      ctx.lineTo(width, height * pos);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /**
   * Desenha a linha central quando não há sinal.
   * @private
   */
  _drawCenterLine(ctx, width, height) {
    ctx.strokeStyle = 'rgba(100, 160, 220, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  // ================================================================
  //  ESPECTRO FFT
  // ================================================================

  /**
   * Desenha o espectro de frequências.
   * @param {Float32Array} buffer - Dados FFT em dB
   * @param {number} sampleRate - Taxa de amostragem
   * @param {number|null} fundamentalFreq - Frequência fundamental detectada (Hz)
   */
  drawSpectrum(buffer, sampleRate, fundamentalFreq) {
    if (this.frozen) return;

    const canvas = this.fftCanvas;
    const ctx = this.fftCtx;
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    // Limpar
    ctx.fillStyle = this.fftBgColor;
    ctx.fillRect(0, 0, width, height);

    if (!buffer || buffer.length === 0) return;

    // Grade e labels
    this._drawFFTGrid(ctx, width, height, sampleRate);

    // Calcular quantos bins correspondem à faixa exibida
    const nyquist = sampleRate / 2;
    const binCount = buffer.length;
    const maxBin = Math.floor((this.fftMaxFreq / nyquist) * binCount);
    const displayBins = Math.min(maxBin, binCount);

    // Margem para labels
    const marginBottom = 22;
    const drawHeight = height - marginBottom;
    const marginLeft = 0;
    const drawWidth = width - marginLeft;

    // Encontrar min/max para normalizar
    const minDb = -100;
    const maxDb = -10;

    // Desenhar barras do espectro
    const barWidth = Math.max(1, drawWidth / displayBins);

    // Desenhar como caminho preenchido (mais performático)
    ctx.beginPath();
    ctx.moveTo(marginLeft, drawHeight);

    for (let i = 0; i < displayBins; i++) {
      const db = Math.max(minDb, Math.min(maxDb, buffer[i]));
      const normalized = (db - minDb) / (maxDb - minDb);
      const barHeight = normalized * drawHeight;

      const x = marginLeft + (i / displayBins) * drawWidth;
      const y = drawHeight - barHeight;

      ctx.lineTo(x, y);
    }

    // Fechar o caminho
    ctx.lineTo(marginLeft + drawWidth, drawHeight);
    ctx.closePath();

    // Gradiente de preenchimento
    const gradient = ctx.createLinearGradient(0, 0, 0, drawHeight);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
    gradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.12)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Linha de contorno
    ctx.beginPath();
    ctx.moveTo(marginLeft, drawHeight);
    for (let i = 0; i < displayBins; i++) {
      const db = Math.max(minDb, Math.min(maxDb, buffer[i]));
      const normalized = (db - minDb) / (maxDb - minDb);
      const barHeight = normalized * drawHeight;
      const x = marginLeft + (i / displayBins) * drawWidth;
      const y = drawHeight - barHeight;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.fftBarColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Destacar frequência fundamental
    if (fundamentalFreq && fundamentalFreq > 0) {
      this._drawFundamentalMarker(ctx, fundamentalFreq, sampleRate,
        displayBins, drawWidth, drawHeight, marginLeft, buffer, minDb, maxDb);
    }

    // Labels de frequência no eixo X
    this._drawFFTLabels(ctx, width, height, drawHeight, sampleRate, displayBins, marginLeft, drawWidth);
  }

  /**
   * Desenha a grade do espectro.
   * @private
   */
  _drawFFTGrid(ctx, width, height, sampleRate) {
    const marginBottom = 22;
    const drawHeight = height - marginBottom;

    ctx.strokeStyle = this.fftGridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    // Linhas horizontais
    for (let i = 1; i < 4; i++) {
      const y = (drawHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  /**
   * Desenha o marcador da frequência fundamental no espectro.
   * @private
   */
  _drawFundamentalMarker(ctx, freq, sampleRate, displayBins, drawWidth, drawHeight, marginLeft, buffer, minDb, maxDb) {
    const nyquist = sampleRate / 2;
    const binCount = buffer.length;

    // Posição X da fundamental
    const bin = (freq / nyquist) * binCount;
    if (bin >= displayBins || bin < 0) return;

    const x = marginLeft + (bin / displayBins) * drawWidth;

    // Linha vertical
    ctx.strokeStyle = this.fundamentalColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, drawHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Label da frequência
    ctx.fillStyle = this.fundamentalColor;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(freq)} Hz`, x, 12);

    // Marcadores de harmônicos (2x, 3x, 4x)
    ctx.globalAlpha = 0.35;
    for (let h = 2; h <= 4; h++) {
      const hFreq = freq * h;
      const hBin = (hFreq / nyquist) * binCount;
      if (hBin >= displayBins) break;
      const hx = marginLeft + (hBin / displayBins) * drawWidth;

      ctx.strokeStyle = 'rgba(255, 215, 64, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, drawHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Desenha os labels de frequência no eixo X.
   * @private
   */
  _drawFFTLabels(ctx, width, height, drawHeight, sampleRate, displayBins, marginLeft, drawWidth) {
    const nyquist = sampleRate / 2;
    const binCount = displayBins * (nyquist / this.fftMaxFreq);

    ctx.fillStyle = this.textColor;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    // Frequências de referência para label
    const labelFreqs = [100, 200, 300, 400, 500, 600, 800, 1000];

    for (const f of labelFreqs) {
      if (f > this.fftMaxFreq) break;
      const x = marginLeft + (f / this.fftMaxFreq) * drawWidth;
      ctx.fillText(`${f}`, x, height - 4);
    }

    // Label "Hz" no final
    ctx.fillText('Hz', width - 14, height - 4);
  }

  // ================================================================
  //  CONTROLE
  // ================================================================

  /**
   * Congela a visualização (mantém o último frame).
   */
  freeze() {
    this.frozen = true;
  }

  /**
   * Descongela a visualização.
   */
  unfreeze() {
    this.frozen = false;
    this._setupCanvas(this.waveCanvas);
    this._setupCanvas(this.fftCanvas);
  }

  /**
   * Desenha estado inicial (sem sinal).
   */
  drawIdle() {
    // Waveform vazia
    const ww = this.waveCanvas.getBoundingClientRect().width;
    const wh = this.waveCanvas.getBoundingClientRect().height;
    this.waveCtx.fillStyle = this.waveBgColor;
    this.waveCtx.fillRect(0, 0, ww, wh);
    this._drawWaveGrid(this.waveCtx, ww, wh);
    this._drawCenterLine(this.waveCtx, ww, wh);

    // FFT vazia
    const fw = this.fftCanvas.getBoundingClientRect().width;
    const fh = this.fftCanvas.getBoundingClientRect().height;
    this.fftCtx.fillStyle = this.fftBgColor;
    this.fftCtx.fillRect(0, 0, fw, fh);
    this._drawFFTGrid(this.fftCtx, fw, fh, 44100);
  }

  /**
   * Define a faixa máxima de frequência do espectro.
   * @param {number} maxFreq - Frequência máxima em Hz
   */
  setFFTMaxFreq(maxFreq) {
    this.fftMaxFreq = maxFreq;
  }

  /**
   * Libera recursos.
   */
  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }
}
