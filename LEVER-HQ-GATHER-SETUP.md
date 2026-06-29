# Lever HQ — Gather Space Setup

> Criado em 2026-05-26 via Claude + Playwright. Espaço base pronto. Personalização visual final fica manual no Map Maker (~15-20min).

## URLs principais

- **Espaço:** https://app.gather.town/app/lOenxfwwcxRpOiRj/Lever%20HQ
- **Map Maker (editor):** abrir o espaço → ícone `chave inglesa` (canto inf esq) → "Edit map"
  - Atalho direto: https://app.gather.town/space/lOenxfwwcxRpOiRj/mapmaker
- **Convite por link:** equipe já recebeu (Pedro, Campanhã, Wesley, Joao Vithor entraram em 26/05)

## Identidade visual extraída de leverecom.com.br

| Token | Valor | Onde usar |
|---|---|---|
| Vermelho Lever | `#dc2626` / `oklch(0.577 0.245 27.325)` | Acento — paredes, banners, objetos destacáveis |
| Vermelho secundário | `#ef4444` / `oklch(0.637 0.237 25.331)` | Hover/destaque secundário |
| Preto principal | `#0a0a0a` / `#171717` | Pisos, base, sombras |
| Off-white | `#fafafa` / `#ffffff` | Texto, contraste |
| Fonte | Inter Tight Variable | Banners e textos custom |

**Logo Lever:** `C:\Users\Cliente\Desktop\lever-logo-gather.png` (1080×1080, fundo vermelho com "L" branca estilizada)

## Estrutura combinada com o Pedro

- **6 salas privadas** (Private Area) — uma por pessoa: Pedro, João Victor, João Bauer, Matheus, Wesley, Campanhã
- **1 sala de reunião grande** (open, sem private area — todos veem/ouvem)
- **1 lounge social** (open, sofás, café — papo casual)

## Template escolhido

**Industrial — 18 a 25 pessoas.** Piso de madeira marrom, paredes de tijolo, mesas, sofás, área lounge. Já vem com 24 mesas individuais (Desk 1 a 24) e várias mesas de reunião. O quadro "YOUR LOGO HERE" acima da sala central é onde vai o logo Lever.

## Passo-a-passo manual (~15-20min)

### 1. Abrir o Map Maker
1. Entre no espaço (URL acima)
2. Canto inferior esquerdo: clique no botão de **chave inglesa / Build** (ícone com 3 quadradinhos azul)
3. Submenu: **"Edit in Mapmaker"** (abre em nova aba)

### 2. Subir o logo Lever no quadro "YOUR LOGO HERE"
1. No Map Maker, abra **"Objects"** (painel esquerdo) → aba **"Upload Custom"** (ou "+ Custom")
2. Clique **"Upload Image"** → selecione `C:\Users\Cliente\Desktop\lever-logo-gather.png`
3. Nome: `Lever Logo`. Tamanho recomendado: **128×128px** (Gather redimensiona automaticamente)
4. Posicione no mapa **em cima do quadro "YOUR LOGO HERE"** (~tile 15,5 — central, acima da mesa principal)
5. Repita o objeto **uma vez em cada sala individual** (decoração de identidade)
6. Salve: **Ctrl+S** ou botão "Save" no canto sup direito

### 3. Renomear as 6 salas privadas
Cada Private Area já existente no template tem um nome (Mesa 1, Mesa 2, ...). Vou listar o procedimento de uma vez (repetir 6x):

1. No Map Maker, abra a aba **"Areas"** (painel esquerdo, ícone retângulo tracejado)
2. **Selecione uma Private Area existente** (clique em cima do retângulo destacado no mapa)
3. No inspector lateral direito, no campo **"Area name"**, troque por:
   - Sala Pedro
   - Sala João Victor
   - Sala João Bauer
   - Sala Matheus
   - Sala Wesley
   - Sala Campanhã
4. Se quiser **bloquear visualmente** (só dono entra), clique no botão **"Door"** no inspector e configure "Knock to enter"
5. **Salve a cada troca** (Ctrl+S)

> 💡 **Atalho rápido pra renomear:** dentro do espaço (não no Map Maker), entre na área privada → clique no ícone de **lápis** ao lado do nome no painel direito → digite novo nome → Enter

### 4. Configurar a sala grande de reunião
1. No Map Maker, ache a **mesa redonda grande** (no template Industrial fica perto do lounge)
2. Crie uma **"Area"** (ferramenta retângulo) em volta da mesa
3. Tipo: **"Spotlight"** ou deixar livre (todos ouvem todos)
4. Nome: `Sala de Reunião Lever`
5. Salve

### 5. Configurar o lounge social
1. Ache a área de **sofás** (canto sup esq do template)
2. Deixe **sem Private Area** (papo cruzado entre quem passa)
3. (Opcional) Adicione objetos: mesa de café, planta, quadro branco
4. Nome decorativo via **placa flutuante**: Objects → "Sign" → digite "Lounge Lever"

### 6. (Opcional) Aplicar paleta Lever onde permitido
Gather **não permite trocar a cor dos sprites do template**, mas você pode:
- **Trocar o piso** de algumas áreas (paint floor) por **tile preto** (`#0a0a0a`)
- **Adicionar paredes vermelhas** decorativas (Objects → Wall variants) onde houver paleta similar
- **Banner Lever** custom: Objects → Sign → fundo `#dc2626`, texto branco

### 7. Atribuir mesas pra cada pessoa
1. No espaço (não Map Maker), entre numa "Desk N" vazia
2. Clique no nome da mesa no painel direito → **"Assign desk"** → digite email da pessoa
3. Quando o membro entrar, o avatar dele é spawnado direto na mesa atribuída

| Pessoa | Sugestão de Desk |
|---|---|
| Pedro | Desk 1 (entrada principal) |
| João Victor | Desk 2 |
| João Bauer | Desk 3 |
| Matheus | Desk 4 |
| Wesley | Desk 5 |
| Campanhã | Desk 6 |

## Configurações administrativas (faça primeiro)

No espaço → **Settings (engrenagem)**:

- [ ] **General** → renomeie display name pra `Lever HQ` (já tá)
- [ ] **General** → adicione descrição: "HQ virtual da Lever Group — squad agência"
- [ ] **Permissions** → "Who can build/edit?" → mude pra **"Admins only"** (evita equipe quebrar o mapa por acidente)
- [ ] **Permissions** → "Who can shout?" → **"Admins only"** (broadcast só Pedro/JV)
- [ ] **Members** → promova **Pedro** e **João Victor** a **Admin**
- [ ] **Account** → considere upgrade pra plano pago se mais de 25 pessoas usarem (trial expira em 30 dias)

## Trial gratuito

Conta atual: **avaliação 30 dias** (expira ~25/06/2026). Após:
- **Free tier:** até 10 simultâneos, 25 reservados — provavelmente suficiente pra squad
- **Pago:** US$ 7/usuário/mês (plano Business)

## Pendências conhecidas

- [ ] Logo Lever subido nos 6 quadros individuais (tarefa #2 acima)
- [ ] 6 salas privadas renomeadas (tarefa #3 acima)
- [ ] Sala grande de reunião configurada (tarefa #4)
- [ ] Lounge nomeado (tarefa #5)
- [ ] Mesas atribuídas a emails (tarefa #7)
- [ ] Permissões admin restritas ao Pedro+JV (configurações adm)

## Pra deletar este doc

Quando terminar a configuração manual e o espaço estiver estável, este `.md` vira histórico — pode mover pra `~/Lever QI/Operações/Gather/` ou apagar.
