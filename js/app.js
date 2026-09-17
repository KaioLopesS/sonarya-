/**
 * ============================================================
 * app.js — Módulo Principal / Orquestração
 * ============================================================
 * Conecta AudioCapture, PitchDetector e AudioVisualizer.
 * Gerencia o loop principal, interface, eventos e estados.
 *
 * Loop principal (requestAnimationFrame):
 *   1. Obter dados de áudio (time domain + frequency)
 *   2. Calcular RMS / peak / clipping
 *   3. Detectar pitch (YIN)
 *   4. Suavizar e converter nota
 *   5. Atualizar a interface e os alertas
 *   6. Renderizar canvas (waveform + FFT)
 * ============================================================
 */

class App {
  constructor() {
    // ---- Módulos ----
    this.audio = new AudioCapture();
    this.pitch = new PitchDetector();
    this.visualizer = null; // Inicializado após DOM ready

    // ---- Estado ----
    this.isRunning = false;
    this.isFrozen = false;
    this.isCalibrating = false;
    this.animationFrameId = null;

    // ---- Histórico ----
    /** @type {{ note: string }[]} */
    this.noteHistory = [];
    this.maxHistory = 10;
    this.lastHistoryNote = null;

    // ---- Calibração ----
    this.calibrationSamples = [];
    this.calibrationDuration = 2000; // ms
    this.calibrationStartTime = 0;

    // ---- DOM Elements (cacheados) ----
    this.dom = {};

    // ---- Bind ----
    this._loop = this._loop.bind(this);
  }

  // ================================================================
  //  INICIALIZAÇÃO
  // ================================================================

  /**
   * Inicializa a aplicação quando o DOM estiver pronto.
   */
  init() {
    this._cacheDOMElements();
    this._setupVisualizer();
    this._bindEvents();
    this._setupAudioCallbacks();
    this._updateMicStatus();
    this.visualizer.drawIdle();
  }

  /**
   * Cacheia referências aos elementos do DOM para evitar queries repetidas.
   * @private
   */
  _cacheDOMElements() {
    this.dom = {
      // Header
      micStatusDot: document.getElementById('mic-status-dot'),
      micStatusText: document.getElementById('mic-status-text'),
      micStatusWrap: document.getElementById('mic-status'),

      // Buttons
      btnMicStart: document.getElementById('btn-mic-start'),
      btnMicStop: document.getElementById('btn-mic-stop'),
      btnFreeze: document.getElementById('btn-freeze'),
      btnCalibrate: document.getElementById('btn-calibrate'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // Note card
      noteName: document.getElementById('note-name'),
      noteCents: document.getElementById('note-cents'),
      centsBarIndicator: document.getElementById('cents-bar-indicator'),

      // Canvas
      waveCanvas: document.getElementById('wave-canvas'),
      fftCanvas: document.getElementById('fft-canvas'),

      // Alert
      alertBanner: document.getElementById('alert-banner'),
      alertText: document.getElementById('alert-text'),

      // History
      historyList: document.getElementById('history-list'),

      // Settings
      selectSensitivity: document.getElementById('select-sensitivity'),
      selectAccidentals: document.getElementById('select-accidentals'),

      // Frozen badge
      frozenBadge: document.getElementById('frozen-badge'),

      // Calibration overlay
      calibrationOverlay: document.getElementById('calibration-overlay'),
      calibrationProgress: document.getElementById('calibration-progress-fill'),
    };
  }

  /**
   * Inicializa o visualizador com os canvas.
   * @private
   */
  _setupVisualizer() {
    this.visualizer = new AudioVisualizer(
      this.dom.waveCanvas,
      this.dom.fftCanvas
    );
  }

  /**
   * Configura callbacks do módulo de áudio.
   * @private
   */
  _setupAudioCallbacks() {
    this.audio.onStateChange = (newState) => {
      this._updateMicStatus();

      if (newState === 'denied') {
        this._showAlert('Permissão de microfone negada. Permita o acesso nas configurações do navegador.', 'error');
      } else if (newState === 'error') {
        this._showAlert('Erro ao acessar o microfone. Verifique se o dispositivo está conectado.', 'error');
      }
    };
  }

  /**
   * Vincula eventos de UI.
   * @private
   */
  _bindEvents() {
    // Microfone
    this.dom.btnMicStart.addEventListener('click', () => this._startMic());
    this.dom.btnMicStop.addEventListener('click', () => this._stopMic());

    // Congelar
    this.dom.btnFreeze.addEventListener('click', () => this._toggleFreeze());

    // Calibrar
    this.dom.btnCalibrate.addEventListener('click', () => this._startCalibration());

    // Histórico
    this.dom.btnClearHistory.addEventListener('click', () => this._clearHistory());

    // Sensibilidade
    this.dom.selectSensitivity.addEventListener('change', (e) => {
      this.pitch.setSensitivity(e.target.value);
    });

    // Acidentes
    this.dom.selectAccidentals.addEventListener('change', (e) => {
      this.pitch.setAccidentalMode(e.target.value);
    });

  }

  // ================================================================
  //  CONTROLE DE MICROFONE
  // ================================================================

  async _startMic() {
    const success = await this.audio.start();
    if (success) {
      this.isRunning = true;
      this.pitch.resetSmoothing();
      this._hideAlert();
      this._startLoop();
    }
  }

  _stopMic() {
    this.isRunning = false;
    this.audio.stop();
    this._stopLoop();
    this.pitch.resetSmoothing();
    this._resetDisplay();
    this.visualizer.drawIdle();
  }

  // ================================================================
  //  LOOP PRINCIPAL
  // ================================================================

  _startLoop() {
    if (this.animationFrameId) return;
    this._loop();
  }

  _stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Loop principal — chamado a cada frame de animação.
   * @private
   */
  _loop() {
    if (!this.isRunning || !this.audio.isActive) {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this._loop);

    // 1. Obter dados de áudio
    const timeDomain = this.audio.getTimeDomainData();
    const frequencyData = this.audio.getFrequencyData();

    if (!timeDomain) return;

    // 2. Métricas de nível
    const rms = this.audio.calculateRMS(timeDomain);
    const peak = this.audio.calculatePeak(timeDomain);
    const clipping = this.audio.isClipping(timeDomain);

    // 3. Verificar clipping
    if (clipping) {
      this._showAlert('⚠ Sinal muito alto — possível clipping', 'warning');
    }

    // 5. Calibração em andamento?
    if (this.isCalibrating) {
      this._processCalibration(rms);
      // Ainda desenhar gráficos durante calibração
      this.visualizer.drawWaveform(timeDomain);
      this.visualizer.drawSpectrum(frequencyData, this.audio.sampleRate, null);
      return;
    }

    // 6. Gate de ruído
    let pitchResult = null;
    let processedNote = null;
    let detectedFreq = null;

    if (this.pitch.isSignalAboveNoise(rms)) {
      // 7. Detecção de pitch (YIN)
      pitchResult = this.pitch.detectPitch(timeDomain, this.audio.sampleRate);

      if (pitchResult && pitchResult.confidence > 0.5) {
        // 8. Suavização e estabilidade
        processedNote = this.pitch.processFrequency(
          pitchResult.frequency,
          pitchResult.confidence
        );

        if (processedNote) {
          detectedFreq = processedNote.frequency;
        }
      } else {
        // Sinal presente mas pitch incerto
        this.pitch.processFrequency(0, 0);
      }

      // Limpar alerta de clipping se sinal está OK
      if (!clipping) {
        this._hideAlert();
      }
    } else {
      // Sem sinal significativo
      this.pitch.processFrequency(0, 0);
    }

    // 9. Atualizar display de nota
    if (processedNote) {
      this._updateNoteDisplay(processedNote);
      this._updateHistoryIfChanged(processedNote);
    } else {
      this._showSilence();
    }

    // 10. Renderizar gráficos
    this.visualizer.drawWaveform(timeDomain);
    this.visualizer.drawSpectrum(frequencyData, this.audio.sampleRate, detectedFreq);
  }

  // ================================================================
  //  ATUALIZAÇÃO DA INTERFACE
  // ================================================================

  /**
   * Atualiza o display da nota detectada.
   * @private
   */
  _updateNoteDisplay(processedNote) {
    const { note } = processedNote;

    // Nome da nota com a indicação da oitava (ex.: Lá4, Dó5)
    this.dom.noteName.textContent = note.fullName;
    this.dom.noteName.className = 'note-display__name';

    // Os valores de afinação permanecem ocultos na atividade investigativa.
    const cents = note.cents;

    // Classe de cor dos cents
    let centsClass = 'note-display__cents';
    let barClass = 'cents-bar__indicator';
    this.dom.noteCents.textContent = '';
    if (Math.abs(cents) <= 5) {
      centsClass += ' note-display__cents--tuned';
      barClass += ' cents-bar__indicator--tuned';
    } else if (cents < 0) {
      centsClass += ' note-display__cents--flat';
      barClass += ' cents-bar__indicator--flat';
    } else {
      centsClass += ' note-display__cents--sharp';
      barClass += ' cents-bar__indicator--sharp';
    }
    this.dom.noteCents.className = centsClass;

    // Barra de cents (posição: -50 = 0%, 0 = 50%, +50 = 100%)
    const clamped = Math.max(-50, Math.min(50, cents));
    const percent = 50 + (clamped / 50) * 50;
    this.dom.centsBarIndicator.style.left = `${percent}%`;
    this.dom.centsBarIndicator.className = barClass;
  }

  /**
   * Mostra estado de silêncio/aguardando.
   * @private
   */
  _showSilence() {
    this.dom.noteName.textContent = '—';
    this.dom.noteName.className = 'note-display__name note-display__name--silent';
    this.dom.noteCents.textContent = 'Ouvindo...';
    this.dom.noteCents.className = 'note-display__cents';
    this.dom.centsBarIndicator.style.left = '50%';
    this.dom.centsBarIndicator.className = 'cents-bar__indicator';
  }



  /**
   * Reseta o display para estado inicial.
   * @private
   */
  _resetDisplay() {
    this._showSilence();
    this._hideAlert();
  }

  // ================================================================
  //  STATUS DO MICROFONE
  // ================================================================

  _updateMicStatus() {
    const state = this.audio.state;
    const statusMap = {
      idle: { text: 'Desligado', class: '' },
      requesting: { text: 'Solicitando...', class: 'mic-status--requesting' },
      active: { text: 'Ativo', class: 'mic-status--active' },
      denied: { text: 'Negado', class: 'mic-status--denied' },
      error: { text: 'Erro', class: 'mic-status--denied' }
    };

    const info = statusMap[state] || statusMap.idle;
    this.dom.micStatusText.textContent = info.text;
    this.dom.micStatusWrap.className = `mic-status ${info.class}`;

    // Mostrar/ocultar botões
    if (state === 'active') {
      this.dom.btnMicStart.classList.add('hidden');
      this.dom.btnMicStop.classList.remove('hidden');
    } else {
      this.dom.btnMicStart.classList.remove('hidden');
      this.dom.btnMicStop.classList.add('hidden');
    }
  }

  // ================================================================
  //  ALERTAS
  // ================================================================

  _showAlert(message, type = 'warning') {
    this.dom.alertText.textContent = message;
    this.dom.alertBanner.className = `alert-banner alert-banner--visible alert-banner--${type}`;
  }

  _hideAlert() {
    this.dom.alertBanner.className = 'alert-banner';
  }

  // ================================================================
  //  CONGELAR ANÁLISE
  // ================================================================

  _toggleFreeze() {
    this.isFrozen = !this.isFrozen;

    if (this.isFrozen) {
      this.visualizer.freeze();
      this.dom.btnFreeze.textContent = 'Retomar';
      this.dom.btnFreeze.classList.remove('btn--primary');
      this.dom.btnFreeze.classList.add('btn--success');
      this.dom.frozenBadge.classList.add('frozen-badge--visible');
    } else {
      this.visualizer.unfreeze();
      this.dom.btnFreeze.textContent = 'Congelar';
      this.dom.btnFreeze.classList.remove('btn--success');
      this.dom.btnFreeze.classList.add('btn--primary');
      this.dom.frozenBadge.classList.remove('frozen-badge--visible');
    }
  }

  // ================================================================
  //  CALIBRAÇÃO DE RUÍDO
  // ================================================================

  _startCalibration() {
    if (!this.audio.isActive) {
      this._showAlert('Inicie o microfone antes de calibrar.', 'info');
      return;
    }

    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.calibrationStartTime = performance.now();

    // Mostrar overlay
    this.dom.calibrationOverlay.classList.add('calibration-overlay--visible');
    this.dom.calibrationProgress.style.width = '0%';
  }

  /**
   * Processa uma amostra durante a calibração.
   * @private
   */
  _processCalibration(rms) {
    this.calibrationSamples.push(rms);

    const elapsed = performance.now() - this.calibrationStartTime;
    const progress = Math.min(100, (elapsed / this.calibrationDuration) * 100);
    this.dom.calibrationProgress.style.width = `${progress}%`;

    if (elapsed >= this.calibrationDuration) {
      this._finishCalibration();
    }
  }

  /**
   * Finaliza a calibração.
   * @private
   */
  _finishCalibration() {
    this.isCalibrating = false;

    // Calcular média RMS das amostras
    const sum = this.calibrationSamples.reduce((a, b) => a + b, 0);
    const avgRMS = sum / this.calibrationSamples.length;

    this.pitch.setCalibration(avgRMS);

    // Ocultar overlay
    this.dom.calibrationOverlay.classList.remove('calibration-overlay--visible');

    this._showAlert('Calibração concluída.', 'success');

    // Auto-ocultar alerta após 3s
    setTimeout(() => this._hideAlert(), 3000);
  }

  // ================================================================
  //  HISTÓRICO DE NOTAS
  // ================================================================

  /**
   * Adiciona nota ao histórico se houve mudança real.
   * @private
   */
  _updateHistoryIfChanged(processedNote) {
    const noteName = processedNote.note.fullName;

    if (noteName === this.lastHistoryNote) return;

    this.lastHistoryNote = noteName;

    this.noteHistory.push({
      note: noteName
    });

    if (this.noteHistory.length > this.maxHistory) {
      this.noteHistory.shift();
    }

    this._renderHistory();
  }

  /**
   * Renderiza o histórico no DOM.
   * @private
   */
  _renderHistory() {
    if (this.noteHistory.length === 0) {
      this.dom.historyList.innerHTML = '<span class="history-empty">Nenhuma nota registrada</span>';
      return;
    }

    let html = '';
    for (const item of this.noteHistory) {
      html += `
        <div class="history-item">
          <span class="history-item__note">${item.note}</span>
        </div>
      `;
    }
    this.dom.historyList.innerHTML = html;
  }

  _clearHistory() {
    this.noteHistory = [];
    this.lastHistoryNote = null;
    this._renderHistory();
  }

  // ================================================================
  //  CLEANUP
  // ================================================================

  destroy() {
    this._stopLoop();
    this.audio.stop();
    if (this.visualizer) {
      this.visualizer.destroy();
    }
  }
}

// ================================================================
//  INICIAR APLICAÇÃO
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();

  // Cleanup ao fechar
  window.addEventListener('beforeunload', () => {
    app.destroy();
  });
});
