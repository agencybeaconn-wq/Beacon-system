/**
 * Camada de movimento do NODE — springs no modelo Apple.
 *
 * Base: "Designing Fluid Interfaces" (WWDC 2018). A Apple abandonou o tripé de
 * fisica (massa/rigidez/amortecimento) e expoe dois parametros de designer:
 *
 *   - damping ratio → controla overshoot. 1.0 = critico (sem bounce). <1.0 = oscila.
 *   - response      → em quanto tempo (s) o valor alcanca o alvo. NAO e "duration":
 *                     spring nao tem duracao fixa, o tempo de acomodacao emerge.
 *
 * O framer-motion 12 expoe `bounce` + `duration`, que mapeia 1:1 nesse modelo:
 *   bounce ≈ 1 − dampingRatio     |     duration ≈ response
 *
 * REGRA DE OURO: default e critico (bounce 0). Bounce so quando o gesto do usuario
 * carregou momento (flick, arremesso, soltar um drag). Overshoot num menu que so
 * apareceu parece errado; overshoot num card que voce jogou parece certo.
 */

import type { Transition } from "framer-motion";

/** Converte os parametros da Apple para o formato do framer-motion. */
export function appleSpring(dampingRatio: number, response: number): Transition {
  return {
    type: "spring",
    bounce: Math.max(0, Math.min(1, 1 - dampingRatio)),
    duration: response,
  };
}

/**
 * Presets. Os tres primeiros sao os valores que a Apple documenta no
 * sample code de Fluid Interfaces; o resto deriva deles.
 */
export const spring = {
  /** Reposicionar / mover elemento (o preset de PiP da Apple). Default do sistema. */
  move: appleSpring(1.0, 0.4),
  /** Rotacao — carrega inercia, entao aceita um respiro de overshoot. */
  rotate: appleSpring(0.8, 0.4),
  /** Drawer / sheet / gaveta — o gesto arrasta, entao o overshoot e coerente. */
  sheet: appleSpring(0.8, 0.3),

  /** Micro-interacao (hover, toggle, chip). Rapido e sem bounce. */
  snappy: appleSpring(1.0, 0.25),
  /** Entrada de superficie flutuante (popover, dropdown, tooltip). */
  surface: appleSpring(1.0, 0.3),
  /** Superficie grande (modal, painel). Um pouco mais lento: massa maior le melhor. */
  panel: appleSpring(1.0, 0.42),
  /** Liberacao de gesto com momento (flick, throw). O unico com bounce alto. */
  momentum: appleSpring(0.75, 0.35),
} satisfies Record<string, Transition>;

/**
 * Equivalente nao-vestibular para `prefers-reduced-motion: reduce`.
 * Reduced motion NAO e "sem feedback" — e feedback sem deslocamento.
 * Mantem-se opacidade/cor; corta-se translado, escala e elastico.
 */
export const crossFade: Transition = { duration: 0.2, ease: "easeOut" };

/** Le a preferencia do SO uma vez, fora do React (util em handlers imperativos). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Escolhe entre o spring e o cross-fade conforme a preferencia do usuario. */
export function motionSafe(transition: Transition, reduced: boolean): Transition {
  return reduced ? crossFade : transition;
}

/**
 * Projecao de momento (§6). Dado a velocidade de soltura, devolve o DESLOCAMENTO
 * adicional ate o repouso — o mesmo modelo de desaceleracao do scroll do iOS.
 *
 * IMPORTANTE: nao e a formula de livro-texto v²/(2a). E decaimento exponencial,
 * que e o que a Apple efetivamente entrega no sample code.
 *
 * @param velocity px/s no momento em que o dedo/ponteiro soltou
 * @param decelerationRate 0.998 = scroll normal · 0.99 = mais seco
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Dado uma lista de pontos de encaixe, devolve o mais proximo de ONDE O GESTO VAI
 * PARAR — nao de onde o dedo soltou. E isso que faz um flick parecer um arremesso.
 */
export function snapToProjected(
  current: number,
  velocity: number,
  snapPoints: number[],
  decelerationRate = 0.998,
): number {
  const projected = current + project(velocity, decelerationRate);
  return snapPoints.reduce((best, p) =>
    Math.abs(p - projected) < Math.abs(best - projected) ? p : best,
  );
}

/**
 * Rubber-banding (§9). Resistencia progressiva na borda em vez de parede.
 * Quanto mais passa do limite, menos o elemento acompanha.
 *
 * @param overshoot quanto passou da borda (px)
 * @param dimension tamanho do eixo (px) — normaliza a resistencia
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Velocidade relativa (§5), para APIs de spring que normalizam pela distancia
 * restante. O framer-motion aceita px/s absoluto em `velocity`, entao isso so e
 * necessario em integracoes que pedem o valor normalizado.
 */
export function relativeVelocity(gestureVelocity: number, current: number, target: number): number {
  const distance = target - current;
  return distance === 0 ? 0 : gestureVelocity / distance;
}

/**
 * Rastreador de velocidade por ponteiro (§2). Velocidade do ultimo evento e
 * ruidosa; a Apple usa historico curto. Mantemos ~100ms de janela.
 */
export class VelocityTracker {
  private samples: Array<{ value: number; time: number }> = [];

  constructor(private windowMs = 100) {}

  add(value: number, time = performance.now()): void {
    this.samples.push({ value, time });
    const cutoff = time - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  /** px/s. Zero enquanto nao houver amostras suficientes ou se o tempo nao andou. */
  get velocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.time - first.time) / 1000;
    if (dt <= 0) return 0;
    return (last.value - first.value) / dt;
  }

  reset(): void {
    this.samples = [];
  }
}

/** Histerese padrao antes de comprometer com uma direcao de gesto (§10). */
export const GESTURE_THRESHOLD_PX = 10;
