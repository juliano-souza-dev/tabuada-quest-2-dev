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
- ✅ Contra-comando responsivo: pressionar a direção oposta cancela imediatamente o momentum daquele eixo, sem remover a inércia ao soltar os controles.
- ✅ Rotação suave do navio para a direção do movimento usando interpolação pelo menor ângulo e deltaTime.
- ✅ Câmera com seguimento suave e look-ahead proporcional à velocidade, com retorno amortecido ao centro.
- ⬜ Colisão suave com bordas e obstáculos, incluindo quique amortecido e deslizamento pela superfície.
- ⬜ Correntes marítimas e vento aplicando força física ao navio.
- ⬜ Joystick analógico no touch, mantendo teclado e controles alternativos.
- ⬜ Tremor de câmera em colisões.
- ⬜ Som de água que reage à velocidade e rangido de madeira em curvas.
- ⬜ Reflexo/sombra dinâmica do navio na água.
- ⬜ Esteira dinâmica ligada à velocidade real do navio.
- ✅ Parallax em camadas de mundo, com presets Fundo, Gameplay e Primeiro plano e fatores editáveis por entidade.

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
- ✅ Pinça touch removida do World Editor; touch de um dedo fica dedicado ao pan e zoom permanece no scroll do mouse.
- ⬜ Multi-seleção de entidades.
- ⬜ Alinhamento e distribuição automática.
- ⬜ Snap opcional em grid.
- ⬜ Duplicar entidade por atalho.
- ⬜ Undo/redo global do World Editor.
- ✅ Camadas editáveis com parallax por entidade, incluindo escala visual, opacidade, blur, névoa/tint e sombra.
- ⬜ Inspector de colisão e hitbox.

## Presets de balanço reutilizados do conceito do motor de cenas

O mundo usa a mesma linguagem que já existe no compositionType ship:

- heave: elevação vertical causada pela água
- pitch: inclinação longitudinal simulada
- roll: balanço lateral
- sway: deriva lateral

Os presets do mundo seguem os mesmos perfis conceituais do navio de cena: calm, navigation, rough e heavy. O WorldRuntime aplica esses valores em coordenadas de mundo, enquanto o SceneRuntime continua responsável pelas composições dentro das cenas.

## Próximo pacote recomendado: Ship Navigation V2

1. ✅ Rotação suave usando o menor caminho angular.
2. ✅ Camera look-ahead proporcional à velocidade.
3. Colisão amortecida com bordas e obstáculos.
4. Corrente marítima como força física.
5. Joystick analógico para touch.
6. Esteira ligada à velocidade do navio.
7. Parallax por camada.
8. Áudio reativo à navegação.

A regra arquitetural continua sendo:

WORLD coordinates != SCENE coordinates != UI coordinates

O mundo não deve transformar 390x844 em limite físico. A referência de cena continua sendo apenas um sistema de coordenadas canônico.


## Safety checkpoint antes do parallax

Antes da implementação de profundidade/parallax, o estado estável foi preservado no Git:

- branch: `safety/pre-parallax-20260930-0200`
- commit: `66e36ac541f30106e4d5796f70708cfa4484d6e2`
- descrição: versão imediatamente anterior ao sistema de profundidade/parallax por entidade

Se a implementação de parallax causar regressão grave, esse branch é o ponto de retorno conhecido.
