/**
 * Prompt Builder — Estudio IA
 *
 * Estrutura profissional baseada no agente LEVER - Modelo Camisa.
 * Prompts finais em ingles tecnico profissional.
 * Modo A: Global Sportswear Catalog (FRONT / BACK / SIDE)
 * Modo B: Cenarios & Situacoes Premium (lifestyle, acao, editorial)
 */

export type JerseyView = 'front' | 'back' | 'side' | 'all';
export type PromptMode = 'catalog' | 'lifestyle';

export interface JerseyPromptParams {
  team: string;
  style: string;
  colors: string;
  name?: string;
  number?: string;
  view: JerseyView;
  mode: PromptMode;
  extraDetails?: string;
}

const QUALITY_BLOCK = `Shot on Phase One IQ4 150MP, Schneider Kreuznach 120mm LS f/4.0 Macro lens, 1/250s, f/11, ISO 50. 16-bit ProPhoto RGB color space, uncompressed TIFF-grade output. Fabric micro-texture resolved at fiber level.`;

const NEGATIVE_CONSTRAINTS = `No visible mannequin body parts, no skin, no hangers, no tags, no wrinkles from poor fitting, no motion blur, no lens flare, no chromatic aberration, no watermarks, no text overlays, no logos not present on the original jersey, no invented sponsors.`;

function viewInstruction(view: JerseyView): string {
  switch (view) {
    case 'front': return 'FRONT VIEW — jersey facing directly at camera, perfectly centered, crest and main sponsor fully visible.';
    case 'back': return 'BACK VIEW — jersey turned 180 degrees, showing full back panel, player name and number centered.';
    case 'side': return 'SIDE VIEW — jersey at 45-degree angle, showing sleeve detail, side panel construction and fit.';
    case 'all': return 'Generate 3 separate views: FRONT VIEW (crest/sponsor visible), BACK VIEW (name/number visible), SIDE VIEW (sleeve/panel detail).';
  }
}

export function buildJerseyPrompt(params: JerseyPromptParams): string {
  const hasRefs = params.extraDetails?.includes('[REFERENCE IMAGES PROVIDED]');

  if (params.mode === 'catalog') {
    return `
${hasRefs ? 'Analyze the provided reference images carefully. Reproduce the exact jersey design, colors, patterns, sponsors, badges, and details visible in the references.' : ''}

Subject: ${params.team} official football/soccer jersey, ${params.style}.
${viewInstruction(params.view)}

Visible jersey details:
- Team: ${params.team}
- Colors: ${params.colors || 'as per official team colors'}
- Style: ${params.style}
${params.name ? `- Player name on back: "${params.name}"` : ''}
${params.number ? `- Jersey number: ${params.number}` : ''}
${params.extraDetails && !hasRefs ? `- Additional details: ${params.extraDetails}` : ''}

Fit & drape: Jersey displayed on invisible/ghost mannequin technique. Natural fabric drape showing dry-fit polyester with visible mesh texture. Realistic body shape without any visible mannequin parts.

Lighting: Professional 3-point studio lighting setup. Key light at 45 degrees camera-right, fill light camera-left at 30%, hair/rim light from above-behind for edge separation. Soft gradients, no harsh shadows.

Camera: ${QUALITY_BLOCK}

Background: Pure white (#FFFFFF) seamless cyclorama studio background. Clean infinity curve, no visible floor line.

Negative constraints: ${NEGATIVE_CONSTRAINTS}
    `.trim();
  }

  // Lifestyle mode
  return `
${hasRefs ? 'Analyze the provided reference images carefully. Reproduce the exact jersey design visible in the references.' : ''}

Subject: Professional lifestyle/editorial photograph featuring a ${params.team} ${params.style} football jersey.
${params.colors ? `Colors: ${params.colors}.` : ''}
${params.name ? `Player name: "${params.name}".` : ''}
${params.number ? `Number: ${params.number}.` : ''}

Scene: Dynamic sports environment with cinematic depth of field. Generic athletic model (no specific person). Natural movement and authentic sportswear presentation.

Lighting: Golden hour or dramatic stadium lighting. Professional sports photography quality.

Camera: ${QUALITY_BLOCK}

${params.extraDetails && !hasRefs ? `Additional context: ${params.extraDetails}` : ''}

Negative constraints: ${NEGATIVE_CONSTRAINTS}
  `.trim();
}

export function buildFreePrompt(prompt: string): string {
  return prompt;
}
