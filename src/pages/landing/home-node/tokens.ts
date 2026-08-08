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
  --dur:.7s;--ease:cubic-bezier(.22,1,.36,1);
`;

/** Contato oficial, usado pela home e pelas páginas de serviço. */
export const TELEFONE = '5531984083376';
export const EMAIL = 'nodedev@gmail.com';
export const INSTAGRAM = 'https://www.instagram.com/noode.dev/';

/** Abre o WhatsApp já com o assunto certo: quem chega não precisa se explicar. */
export const waLink = (texto: string) =>
    `https://wa.me/${TELEFONE}?text=${encodeURIComponent(texto)}`;
