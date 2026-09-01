# Prompt para Codex — Analisador Web de Ondas Sonoras

Quero que você crie uma aplicação web moderna para **análise de sons em tempo real usando o microfone do computador**.

A aplicação deve funcionar diretamente no navegador e ter finalidade **didática e científica**, permitindo visualizar características do som e relacioná-las com notas musicais.

Não quero apenas um afinador. Quero um **analisador de ondas sonoras interativo**, visual e educacional.

---

# Objetivo principal

A aplicação deve:

- acessar o microfone do computador pelo navegador;
- captar o áudio em tempo real;
- detectar a frequência fundamental do som;
- identificar a nota musical correspondente;
- mostrar a frequência real medida;
- mostrar a forma da onda em tempo real;
- mostrar o espectro de frequências usando FFT;
- mostrar a intensidade/amplitude relativa do som;
- evitar falsas detecções causadas por ruído ambiente;
- funcionar bem com voz, instrumentos musicais e tons puros.

A interface deve ser bonita, moderna e clara, com aparência de um **instrumento científico educacional**.

---

# Stack sugerida

A aplicação deve ser feita preferencialmente com:

- HTML
- CSS
- JavaScript
- Web Audio API
- Canvas ou SVG para os gráficos

Pode usar uma biblioteca de gráficos apenas se isso realmente melhorar desempenho ou organização.

Evite frameworks pesados sem necessidade.

Se considerar React, Vue ou outra biblioteca realmente vantajosa, explique primeiro por que ela seria necessária.

A prioridade é:

- desempenho;
- baixa latência;
- clareza do código;
- facilidade de executar localmente;
- funcionamento direto no navegador.

---

# Captura de áudio

Use a **Web Audio API**.

O fluxo esperado é:

```text
Microfone
   ↓
getUserMedia()
   ↓
AudioContext
   ↓
Análise de áudio
```

A aplicação deve pedir autorização para acessar o microfone.

Crie estados claros:

```text
Microfone desligado
Solicitando permissão
Microfone ativo
Permissão negada
Erro no dispositivo
```

Inclua um botão:

```text
Iniciar microfone
```

e outro:

```text
Parar microfone
```

---

# Arquitetura do processamento

Quero duas análises em paralelo:

```text
                         MICROFONE
                             │
                             ▼
                       Web Audio API
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        DETECTOR DE PITCH                FFT
        YIN / autocorrelação        análise espectral
                │                         │
                ▼                         ▼
     frequência fundamental       espectro de frequências
                │
                ▼
          nota musical
```

## Importante

Não use simplesmente o maior pico da FFT para determinar a nota musical.

Instrumentos como violão possuem muitos harmônicos, e às vezes um harmônico pode ser mais intenso do que a frequência fundamental.

Para a detecção de pitch, use preferencialmente:

- algoritmo YIN;

ou, como alternativa:

- autocorrelação bem implementada.

A FFT deve ser usada principalmente para **visualização do espectro**.

---

# Nota musical

A aplicação deve converter a frequência fundamental detectada para uma nota musical.

Use como referência:

```text
A4 / Lá4 = 440 Hz
```

A conversão pode utilizar MIDI:

```text
midi = 69 + 12 × log2(f / 440)
```

Reconheça as 12 notas:

```text
Do
Do#
Re
Re#
Mi
Fa
Fa#
Sol
Sol#
La
La#
Si
```

e também a oitava:

```text
La2
La3
La4
La5
Do4
Mi4
etc.
```

A aplicação deve mostrar a **frequência realmente medida**, não substituir pelo valor teórico.

Exemplo:

```text
Nota: La4
Frequência medida: 438.7 Hz
Frequência ideal: 440.0 Hz
```

---

# Sustenido e bemol

Inclua futuramente uma configuração para permitir ao usuário escolher:

```text
Sustenidos
Do#
Re#
Fa#
Sol#
La#
```

ou:

```text
Bemóis
Reb
Mib
Solb
Lab
Sib
```

Na primeira versão, sustenidos podem ser o padrão.

---

# Afinador em cents

Calcule também a diferença entre a frequência medida e a frequência ideal da nota em **cents**.

Exemplo:

```text
La4
438.7 Hz
-5 cents
```

Use uma indicação visual simples:

```text
-50        0        +50
 |---------●---------|
```

Estados visuais:

- afinado;
- abaixo;
- acima.

Não precisa transformar a aplicação em um afinador profissional.

Essa informação deve ser complementar.

---

# Interface principal

Quero uma interface semelhante a um instrumento científico moderno.

Estrutura sugerida:

```text
┌─────────────────────────────────────────────────────────────┐
│ ANALISADOR DE ONDAS SONORAS                  ● MICROFONE   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         NOTA              FREQUÊNCIA          NÍVEL         │
│                                                             │
│         LA4               440.2 Hz            ███████       │
│                                                             │
│                    -2 cents                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ FORMA DA ONDA                                               │
│                                                             │
│       /\       /\       /\       /\                        │
│ _____/  \_____/  \_____/  \_____/  \_____                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ESPECTRO DE FREQUÊNCIAS                                    │
│                                                             │
│                         █                                   │
│              ▂          █       ▃                           │
│       ▂      █     ▃    █   ▄   █                           │
│ ───────────────────────────────────────────────────         │
│ 0    100    200   300  440 500 700       1000 Hz           │
│                        ▲                                    │
│                    440.2 Hz                                 │
├─────────────────────────────────────────────────────────────┤
│ HISTÓRICO                                                   │
│ Mi4   Sol4   La4   La4   Si4   Do5                         │
└─────────────────────────────────────────────────────────────┘
```

---

# Design visual

Use uma estética:

- moderna;
- limpa;
- científica;
- educacional;
- responsiva.

Sugestão:

```text
fundo azul-marinho quase preto
cards escuros
linhas finas
tipografia clara
gráficos brilhantes sem exagero
```

Evite uma aparência de:

- painel gamer;
- afinador de guitarra genérico;
- dashboard empresarial.

Quero algo parecido com um **instrumento de laboratório moderno**.

Use cores funcionalmente:

```text
verde   → sinal válido / afinado
amarelo → sinal fraco
vermelho → clipping / sinal excessivo
cinza   → nenhum sinal
```

---

# Card principal da nota

A nota deve ser o elemento de maior destaque.

Exemplo:

```text
        LA4
      440.2 Hz
      -2 cents
```

Quando não houver sinal confiável:

```text
--
Ouvindo...
```

Não mostre notas aleatórias em silêncio.

---

# Gráfico 1 — Forma da onda

Crie um gráfico em tempo real semelhante a um osciloscópio.

O gráfico deve mostrar:

- amplitude no eixo vertical;
- tempo no eixo horizontal;
- sinal centralizado;
- atualização suave.

Remova o nível DC antes de desenhar.

A onda deve atualizar em aproximadamente:

```text
30–60 FPS
```

sem tentar redesenhar na taxa de amostragem do áudio.

Use `requestAnimationFrame` quando adequado.

---

# Gráfico 2 — Espectro de frequências

Use FFT para mostrar o espectro.

Eixo X:

```text
Frequência (Hz)
```

Eixo Y:

```text
Magnitude relativa
```

Faixa principal inicial:

```text
0 Hz até 1000 Hz
```

Permita futuramente ampliar para:

```text
0–2000 Hz
0–5000 Hz
```

Destaque visualmente:

- frequência fundamental detectada;
- pico correspondente;
- harmônicos visíveis.

Exemplo:

```text
Fundamental:
247 Hz

Harmônicos:
494 Hz
741 Hz
988 Hz
```

Não precisa identificar automaticamente todos os harmônicos na primeira versão, mas o gráfico deve torná-los visíveis.

---

# Nível sonoro / amplitude

Mostre uma barra de intensidade relativa.

Exemplo:

```text
Nível
████████░░
```

Pode usar:

- RMS;
- amplitude média;
- peak level.

Não chame de **dB SPL real** sem calibração física.

Prefira nomenclaturas como:

```text
Amplitude
Nível sonoro relativo
Nível do sinal
```

Se usar dBFS, deixe claro que se trata de nível digital relativo.

---

# Calibração de ruído

Inclua um botão:

```text
Calibrar ambiente
```

Ao clicar:

```text
Calibrando...
Fique em silêncio por 2 segundos
```

Durante esse período:

- medir nível RMS ambiente;
- estimar ruído de fundo;
- criar um limiar automático.

Depois:

```text
Calibração concluída
```

A detecção de pitch só deve ocorrer quando o sinal estiver suficientemente acima do ruído.

---

# Evitar falsas notas

Esse ponto é muito importante.

A aplicação não deve mostrar notas aleatórias quando:

- ninguém está falando;
- não há instrumento tocando;
- existe apenas ruído ambiente;
- existe ventilador ou ruído baixo.

Use uma combinação de:

- RMS mínimo;
- confiança do algoritmo de pitch;
- estabilidade temporal;
- relação sinal/ruído.

A nota só deve aparecer quando houver confiança suficiente.

---

# Estabilização

Não quero que a nota fique pulando rapidamente:

```text
Mi4 → Si4 → Mi5 → Mi4 → La3
```

quando uma única nota está sendo tocada.

Implemente uma suavização moderada.

Exemplos:

- média móvel da frequência;
- mediana das últimas leituras;
- exigir uma nota consistente por algumas dezenas de milissegundos.

Mas não deixe a interface lenta.

Meta:

```text
resposta rápida
+
nota visualmente estável
```

---

# Histórico de notas

Inclua uma área:

```text
Histórico
```

Exemplo:

```text
Mi4   Fa4   Sol4   La4   Si4
329   349   392    440   494 Hz
```

Só adicione uma nova nota quando houver uma mudança real e estável.

Evite adicionar dezenas de entradas iguais.

Mantenha apenas algo como:

```text
últimas 8–12 notas
```

Inclua:

```text
Limpar histórico
```

---

# Botão Congelar

Adicione uma feature:

```text
Congelar análise
```

Quando ativada:

- os gráficos param;
- frequência fica fixa;
- nota fica fixa;
- espectro fica congelado.

Isso é importante para uso em sala de aula.

O usuário deve conseguir observar uma leitura com calma.

Depois:

```text
Retomar análise
```

---

# Modo Educacional

Inclua um modo chamado:

```text
Modo Educacional
```

Quando ativado, mostrar informações adicionais.

Exemplo:

```text
Nota detectada:
La4

Frequência medida:
440.3 Hz

Frequência ideal:
440.0 Hz

Período:
2.27 ms

Diferença:
+1 cent

Oitava abaixo:
La3 = 220 Hz

Oitava acima:
La5 = 880 Hz
```

O período deve ser calculado por:

```text
T = 1 / f
```

Esse modo deve ajudar a ensinar:

- frequência;
- período;
- amplitude;
- notas musicais;
- oitavas.

---

# Comparação de amplitude e frequência

A aplicação deve ser útil para demonstrar que:

```text
frequência ≠ intensidade
```

Ao tocar a mesma nota mais forte:

```text
frequência ≈ igual
amplitude aumenta
```

Ao tocar uma nota mais aguda:

```text
frequência aumenta
```

O design e os gráficos devem ajudar a perceber isso visualmente.

---

# Referência de afinação

Inclua uma configuração:

```text
A4 = 440 Hz
```

Permita alterar futuramente para:

```text
432 Hz
442 Hz
etc.
```

Valor padrão:

```text
440 Hz
```

---

# Sensibilidade

Adicione uma configuração simples:

```text
Sensibilidade

Baixa
Média
Alta
```

Evite inicialmente expor vários parâmetros matemáticos para o usuário comum.

Internamente, esses níveis podem alterar:

- limiar RMS;
- confiança mínima;
- estabilidade.

---

# Alertas úteis

Mostre mensagens quando necessário.

Exemplos:

```text
Sinal muito fraco
```

```text
Sinal muito alto
```

```text
Possível clipping
```

```text
Microfone não detectado
```

```text
Permissão de microfone negada
```

```text
Ambiente muito ruidoso
```

---

# Clipping

Detecte quando o sinal estiver muito próximo dos extremos digitais.

Se houver clipping, mostrar:

```text
⚠ Sinal muito alto
```

Isso ajuda o usuário a:

- afastar o instrumento;
- diminuir o volume;
- diminuir ganho do microfone, se aplicável.

---

# Instrumentos

A primeira versão deve funcionar prioritariamente com sons monofônicos, como:

- voz sustentando uma nota;
- violão tocando uma corda individual;
- teclado tocando uma nota;
- flauta;
- gerador de tom;
- assobio.

Não tente reconhecer acordes nesta primeira versão.

---

# Acordes — versão futura

Deixe a arquitetura organizada para uma futura função:

```text
Reconhecimento de acordes
```

Exemplo:

```text
Do + Mi + Sol
↓
Do maior
```

Mas **não implemente isso agora**.

Reconhecimento polifônico é um problema diferente e não deve comprometer a primeira versão.

---

# Responsividade

A aplicação deve funcionar em:

- desktop;
- notebook;
- tablet;
- celular.

No desktop, mostrar os gráficos com bastante espaço.

No celular, reorganizar os cards verticalmente.

---

# Performance

Evite:

- criar arrays enormes a cada frame;
- recriar Canvas constantemente;
- atualizar o DOM em toda amostra;
- processamentos desnecessários dentro do loop de desenho.

Separe:

```text
processamento de áudio
```

de:

```text
renderização da interface
```

Use buffers reutilizáveis quando possível.

---

# Privacidade

O áudio deve ser processado localmente no navegador.

Não enviar áudio para servidor.

Deixe isso visível na interface:

```text
Seu áudio é processado localmente e não é enviado para nenhum servidor.
```

---

# Estrutura de arquivos

Organize de forma simples.

Exemplo:

```text
analisador-web/
│
├── index.html
├── css/
│   └── style.css
│
├── js/
│   ├── audio.js
│   ├── pitch.js
│   ├── visualizer.js
│   └── app.js
│
└── README.md
```

Se essa divisão for desnecessária, simplifique.

Não crie arquitetura excessiva.

---

# README

Crie um README explicando:

1. objetivo do projeto;
2. tecnologias utilizadas;
3. como executar localmente;
4. necessidade de HTTPS ou localhost para acessar o microfone;
5. como permitir acesso ao microfone;
6. como funciona a detecção de frequência;
7. diferença entre pitch detection e FFT;
8. como funciona a conversão frequência → nota;
9. limitações com acordes;
10. como usar o modo educacional;
11. como calibrar o ruído;
12. navegadores recomendados.

---

# Primeira versão mínima funcional

Antes de implementar todas as features, faça uma V1 sólida com:

1. acesso ao microfone;
2. waveform em tempo real;
3. FFT em tempo real;
4. detecção de frequência fundamental;
5. nota musical;
6. oitava;
7. nível do sinal;
8. rejeição de silêncio;
9. interface responsiva.

Depois adicione:

10. cents;
11. histórico;
12. congelar;
13. calibração;
14. modo educacional.

---

# Testes

Inclua procedimentos de teste.

## Teste 1 — tom puro

Use:

```text
440 Hz
```

Resultado esperado:

```text
La4
≈ 440 Hz
```

## Teste 2 — oitavas

```text
220 Hz → La3
440 Hz → La4
880 Hz → La5
```

## Teste 3 — violão

Cordas soltas:

```text
Mi2  ≈ 82.41 Hz
La2  = 110.00 Hz
Re3  ≈ 146.83 Hz
Sol3 ≈ 196.00 Hz
Si3  ≈ 246.94 Hz
Mi4  ≈ 329.63 Hz
```

## Teste 4 — intensidade

Tocar a mesma nota:

```text
fraca
forte
```

A frequência deve permanecer aproximadamente igual.

A amplitude deve mudar.

## Teste 5 — silêncio

Sem som:

```text
Nenhuma nota
```

A interface deve mostrar algo como:

```text
Ouvindo...
```

e não gerar notas aleatórias.

---

# Importante sobre precisão

Não quero que a interface finja uma precisão que o algoritmo não possui.

Se a detecção estiver instável:

- não mostrar dezenas de casas decimais;
- usar 1 casa decimal quando fizer sentido;
- ocultar a nota quando a confiança estiver baixa.

Exemplo adequado:

```text
440.2 Hz
```

Evite:

```text
440.237194826 Hz
```

---

# Filosofia do projeto

Esse projeto é principalmente **educacional**.

O objetivo é permitir que o usuário:

- veja a forma de uma onda sonora;
- compreenda amplitude;
- compreenda frequência;
- relacione frequência com altura musical;
- veja as notas;
- observe oitavas;
- observe harmônicos;
- compare sons.

A prioridade é:

```text
clareza
+
estabilidade
+
visualização
+
valor didático
```

e não construir um afinador profissional.

---

# Antes de escrever o código

Antes de implementar:

1. analise os requisitos;
2. proponha a arquitetura;
3. explique como pretende detectar pitch;
4. explique como pretende fazer a FFT;
5. explique como separar processamento e renderização;
6. explique como evitar falsas notas;
7. proponha a estrutura visual;
8. aponte riscos técnicos;
9. só depois comece a implementação.

Não escreva todo o projeto de uma vez sem explicar a estratégia.

---

# Entregáveis

Ao final, quero receber:

- aplicação web completa;
- HTML;
- CSS;
- JavaScript;
- README;
- instruções para execução;
- comentários nos principais trechos;
- algoritmo de pitch documentado;
- FFT em tempo real;
- waveform em tempo real;
- histórico;
- modo congelar;
- modo educacional;
- calibração de ruído;
- layout responsivo;
- tratamento de erros de permissão do microfone.

---

# Prioridade final

A primeira versão deve fazer muito bem:

```text
MICROFONE DO COMPUTADOR
        ↓
CAPTURA DE ÁUDIO
        ↓
FORMA DA ONDA
        ↓
DETECÇÃO DE FREQUÊNCIA FUNDAMENTAL
        ↓
NOTA MUSICAL
        ↓
FFT / ESPECTRO
        ↓
VISUALIZAÇÃO DIDÁTICA EM TEMPO REAL
```

Não adicione recursos avançados que prejudiquem a estabilidade da primeira versão.
