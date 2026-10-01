# World Navigation & World Editor Roadmap

Este documento registra o estado do mundo navegável 2D, da navegação do navio e das ferramentas do World Editor. Ele existe para que as decisões e pendências não se percam conforme o motor evolui.

## Legenda

- ✅ pronto e disponível
- 🟡 parcialmente pronto
- ⬜ planejado / faltando

## Navegação do navio

- ✅ Movimento com aceleração, velocidade e inércia.
- ✅ Atrito da água aplicado por frame.
- ✅ Limite de velocidade máxima.
- ✅ Normalização diagonal para impedir ganho de velocidade em diagonal.
- ✅ Movimento baseado em deltaTime.
- 🟡 Rotação do navio para a direção do movimento. A direção já é calculada, mas ainda falta interpolação suave pelo menor ângulo.
- 🟡 Câmera com seguimento suave frame-rate independent usando exponencial `1 - exp(-dt * 4.5)`. Ainda falta look-ahead baseado na velocidade.
- ⬜ Colisão suave com bordas e obstáculos, incluindo quique amortecido e deslizamento pela superfície.
- ⬜ Correntes marítimas e vento aplicando força física ao navio.
- ✅ Joystick analógico no touch, com intensidade proporcional, dead zone e teclado preservado.
- ✅ Navegação por toque/clique no mundo, com alvo visual e desaceleração na aproximação.
- ⬜ Tremor de câmera em colisões.
- ⬜ Som de água que reage à velocidade e rangido de madeira em curvas.
- ⬜ Reflexo/sombra dinâmica do navio na água.
- ⬜ Esteira dinâmica ligada à velocidade real do navio.
- ✅ Parallax visual do oceano em 3 camadas: água profunda, ondas e espuma, com fatores independentes e navios/entidades em 1.0.

## Oceano

- ✅ Criação de novos oceanos pelo World Editor.
- ✅ Nome, ID, largura e altura configuráveis.
- ✅ Background selecionável a partir dos assets.
- ✅ Presets Calmo, Aventura e Tempestade.
- ✅ Velocidade visual da água.
- ✅ Direção horizontal e vertical.
- ✅ Ondulação.
- ✅ Escala da textura.
- ✅ Brilho e saturação.
- ✅ Preview imediato no editor e no Play.
- ✅ Três camadas visuais de oceano com textura, parallax, deriva X/Y, escala e opacidade configuráveis por sliders.
- ⬜ Correntes por região com vetores próprios.
- ⬜ Zonas marítimas com comportamento diferente dentro do mesmo mundo.
- ⬜ Ondas locais que influenciam fisicamente entidades e navios.

## World Editor: entidades

- ✅ Inserção de assets como WorldEntity.
- ✅ Semântica visual desacoplada: reconhecer `location`, `region`, `background` etc. não cria card, borda ou rótulo visual no mundo.
- ✅ Entidades com sprite são renderizadas como o asset original; o tipo lógico fica apenas nos dados e nas interações.
- ✅ Seleção e movimentação por drag.
- ✅ Edição numérica de X e Y.
- ✅ Edição de largura e altura.
- ✅ Rotação por valor.
- ✅ Gizmo visual de rotação diretamente no canvas.
- ✅ Gizmo visual de redimensionamento diretamente no canvas.
- ✅ Opção de manter proporção ao redimensionar.
- ✅ Atalhos de rotação -90°, 0° e +90°.
- ✅ Efeito genérico de balanço para entidades do mundo.
- ✅ Presets de balanço: sem balanço, mar calmo, navegação natural, mar agitado e objeto pesado.
- ✅ Controles de heave, pitch, roll, sway e velocidade.
- ✅ Preview do balanço no próprio mundo.
- ✅ Vocabulário de animação alinhado ao motor de composição de navios das cenas.
- ✅ Barris, baús e navios recebem presets iniciais coerentes quando são adicionados por Assets.
- ✅ Ligação de WorldEntity com SceneRuntime por cena vinculada.
- ✅ Exportação de world.json.
- ✅ Draft local do mundo no DEV.
- ⬜ Multi-seleção de entidades.
- ⬜ Alinhamento e distribuição automática.
- ⬜ Snap opcional em grid.
- ⬜ Duplicar entidade por atalho.
- ⬜ Undo/redo global do World Editor.
- ⬜ Camadas editáveis com parallax por entidade.
- ⬜ Inspector de colisão e hitbox.

## Presets de balanço reutilizados do conceito do motor de cenas

O mundo usa a mesma linguagem que já existe no compositionType ship:

- heave: elevação vertical causada pela água
- pitch: inclinação longitudinal simulada
- roll: balanço lateral
- sway: deriva lateral

Os presets do mundo seguem os mesmos perfis conceituais do navio de cena: calm, navigation, rough e heavy. O WorldRuntime aplica esses valores em coordenadas de mundo, enquanto o SceneRuntime continua responsável pelas composições dentro das cenas.

## Próximo pacote recomendado: Ship Navigation V2

1. Rotação suave usando o menor caminho angular.
2. Camera look-ahead proporcional à velocidade.
3. Colisão amortecida com bordas e obstáculos.
4. Corrente marítima como força física.
5. ✅ Joystick analógico para touch + navegação por clique.
6. Esteira ligada à velocidade do navio.
7. ✅ Parallax visual do oceano por camada.
8. Áudio reativo à navegação.

A regra arquitetural continua sendo:

WORLD coordinates != SCENE coordinates != UI coordinates

O mundo não deve transformar 390x844 em limite físico. A referência de cena continua sendo apenas um sistema de coordenadas canônico.


## Implementação segura após checkpoint

O pacote de joystick analógico + navegação por clique foi implementado a partir do checkpoint seguro `66e36ac541f30106e4d5796f70708cfa4484d6e2`, sem reintroduzir o pacote posterior de parallax.

- Joystick: vetor analógico contínuo, intensidade proporcional e dead zone.
- Teclado: WASD e setas continuam disponíveis.
- Clique/toque: converte coordenadas da tela para o mundo respeitando câmera, zoom e margens navegáveis.
- Prioridade: teclado/joystick cancelam um alvo de clique em andamento.
- Aproximação: a força reduz perto do destino para evitar oscilações grandes.


## Oceano em camadas

A câmera de Play segue o jogador com suavização exponencial dependente de `dt`, usando sharpness 4.5. Navios e entidades permanecem em coordenadas WORLD, fator 1.0.

As camadas visuais padrão do oceano são:

- deep: parallax 0.22, deriva 7 / 4
- wave: parallax 0.45, deriva 18 / 11
- foam: parallax 0.68, deriva 36 / 24

O World Editor permite editar textura, parallax, deriva X/Y, escala da camada e opacidade sem alterar a física do mundo.


## NPC navigation follow-up

Temporary implementation:
- per-world NPC population;
- pseudo-random spawn with configurable spacing;
- straight-line navigation;
- wrap at world bounds.

Pending task:
- replace straight-line movement with full NPC navigation AI;
- route/path selection;
- island and obstacle avoidance;
- collision avoidance between NPC ships;
- patrol zones;
- pursuit/escape behavior;
- combat approach and disengage behavior;
- persistence of NPC route/state between region transitions.
