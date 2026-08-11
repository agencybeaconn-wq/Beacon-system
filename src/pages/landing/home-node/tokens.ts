/**
 * Paleta e ritmo da marca NODE, em um lugar só.
 *
 * A home e as páginas de serviço importam daqui, então mudar uma cor aqui muda o
 * site inteiro. Antes disso os tokens viviam duplicados dentro de cada página, que
 * é exatamente como uma paleta desanda com o tempo.
 *
 * Regras que sustentam essas escolhas (ver DESIGN.md §2):
 *  - base azulada, nunca preto puro
 *  - texto gelo, nunca #ffffff
 *  - um único acento (violeta), presente também na arte de partículas
 */
export const TOKENS = `
  --bg:#08090C;--bg-elev:#0E1017;--fg:#EEF1F7;--muted:#8A90A2;--dim:#B9C0D0;
  --line:rgba(190,200,225,.11);--line-hi:rgba(190,200,225,.20);
  --accent:#8B6FE0;--accent-hi:#A48CEE;--accent-dim:rgba(139,111,224,.14);

  /* MOTION — uma curva só, duas durações.
     --dur    MACRO: entrada de seção, reveal, cortina. O tempo cinematográfico.
     --micro  MICRO: resposta ao mouse (hover, active, foco).
     Estavam colapsados numa duração só: cada botão levava 700ms pra reagir ao
     ponteiro, e o site inteiro lia como travado. Reveal lento é direção de arte;
     hover lento é bug de percepção. */
  --dur:.55s;--micro:.18s;--ease:cubic-bezier(.22,1,.36,1);

  /* RAIO — três degraus e a pílula. Antes eram 11/14/16/18/22/30px espalhados,
     que é ruído visível quando dois cards vizinhos têm cantos diferentes. */
  --r-sm:10px;--r-md:16px;--r-lg:28px;--r-pill:999px;

  /* ESCALA TIPOGRÁFICA — razão 1.2 a partir de 1.05rem.
     Os h3 viviam em seis tamanhos avulsos (1.02/1.08/1.28/1.35/1.42/1.5rem).
     Título de card é título de card: mesmo nível, mesmo tamanho. */
  --fs-1:1.05rem;--fs-2:1.26rem;--fs-3:1.51rem;
`;

/** Contato oficial, usado pela home e pelas páginas de serviço. */
export const TELEFONE = '5531984083376';
export const EMAIL = 'nodedev@gmail.com';
export const INSTAGRAM = 'https://www.instagram.com/noode.dev/';

/** Abre o WhatsApp já com o assunto certo: quem chega não precisa se explicar. */
export const waLink = (texto: string) =>
    `https://wa.me/${TELEFONE}?text=${encodeURIComponent(texto)}`;
