<p align="center">
  <img src="logo.png" alt="SonaryA" width="280">
</p>

**Sonarya** é uma plataforma web que analisa sons em tempo real, identificando frequência, nota musical e intensidade a partir do microfone do dispositivo.

**Feito por monitores do Programa Institucional de Bolsa de Iniciação à Docência (PIBID), subprojeto de Física, da Universidade Federal do Rio de Janeiro (UFRJ), com apoio da Coordenação de Aperfeiçoamento de Pessoal de Nível Superior – Brasil (CAPES).**

Essa aplicação web foi desenvolvida com o auxílio de inteligência artificial: O Google Antigravity (Claude Opus 4.6).

---

## Objetivo

Permitir que estudantes e professores:

- **Vejam** a forma de uma onda sonora em tempo real (osciloscópio)
- **Compreendam** a relação entre frequência e altura musical
- **Identifiquem** notas musicais a partir de sons captados pelo microfone
- **Observem** o espectro de frequências via FFT (harmônicos, fundamental)
- **Comparem** amplitude vs frequência de forma visual


## Como Funciona a Detecção de Frequência

### Algoritmo YIN (Pitch Detection)

O YIN é um algoritmo de detecção de frequência fundamental baseado em autocorrelação com diferença acumulada normalizada:

1. **Função de diferença $d(\tau)$** — Calcula a soma das diferenças quadráticas entre amostras deslocadas
2. **Normalização cumulativa (CMND)** — Normaliza para evitar favorecimento de lags pequenos
4. **Interpolação parabólica** — Refina a posição do mínimo para precisão sub-amostra

#### Por que não usar apenas o pico da FFT?

Instrumentos como violão e voz possuem **harmônicos** — frequências múltiplas da fundamental. Às vezes, um harmônico é mais intenso que a fundamental. O pico máximo da FFT pode apontar para o 2º ou 3º harmônico, gerando uma nota errada (uma oitava acima, por exemplo).

O YIN detecta corretamente a fundamental mesmo nessas situações.

### FFT (Análise Espectral)

A FFT (*Fast Fourier Transform*) decompõe o sinal nas suas componentes de frequência. Na aplicação, é usada para visualização:

- Mostra quais frequências estão presentes no som
- Destaca a fundamental detectada com uma linha de referência
- Mostra os harmônicos distribuídos ao longo do espectro

## Calibração de Ruído

1. Clique em **"Calibrar Ambiente"**
2. Fique em silêncio por 2 segundos
3. A aplicação mede o nível de ruído de fundo

---

## Limitações

- **Monofônico**: Funciona melhor com uma nota por vez (voz, flauta, corda individual do violão)
- **Sem reconhecimento de acordes**: Múltiplas notas simultâneas não são identificadas separadamente
- **Faixa de detecção**: 60 Hz a 1500 Hz (B1 a F#6)
- **Latência**: ~46ms inerente ao tamanho do buffer de análise (4096 amostras a 44100 Hz)

---

## Estrutura de Arquivos

```
pibid_ondas_sonoras/
├── index.html          ← Estrutura HTML
├── logo.png            ← Logotipo oficial do SonaryA
├── css/
│   └── style.css       ← Folha de estilos e variáveis
├── js/
│   ├── audio.js        ← Captura de áudio (Web Audio API)
│   ├── pitch.js        ← Algoritmo YIN + conversão musical
│   ├── visualizer.js   ← Canvas: waveform + espectro FFT
│   └── app.js          ← Orquestração e interface
└── README.md           ← Documentação do projeto
```

---

## Privacidade
Todo o processamento de áudio é feito **localmente no navegador**. Nenhum dado é gravado ou enviado para servidores externos.
