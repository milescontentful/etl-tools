import type { SeoFields, GeoFields } from './types';

// ---------------------------------------------------------------------------
// AI Action template definitions (mirrors templates/ai-actions.json)
// ---------------------------------------------------------------------------

export interface AiActionVariable {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface AiActionInstruction {
  template: string;
  variables: AiActionVariable[];
}

export interface AiActionConfiguration {
  modelType: string;
  modelTemperature: number;
}

export interface AiActionDefinition {
  name: string;
  description: string;
  instruction: AiActionInstruction;
  configuration: AiActionConfiguration;
}

export const SEO_ACTION_NAME = 'Generate SEO Metadata' as const;
export const GEO_ACTION_NAME = 'Generate AI Discovery Content' as const;
export const TRANSLATE_ACTION_NAME = 'Translate' as const;

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function extractValue(output: string, label: string): string {
  const regex = new RegExp(`^${label}:\\s*(.+)`, 'm');
  const match = output.match(regex);
  return match?.[1]?.trim() ?? '';
}

function extractListItems(output: string, label: string): string[] {
  const regex = new RegExp(`^${label}:\\s*\\n((?:- .+\\n?)*)`, 'm');
  const match = output.match(regex);
  if (!match?.[1]) return [];
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// parseSeoOutput
// ---------------------------------------------------------------------------

/**
 * Parses the structured text output from the "Generate SEO Metadata" AI action
 * into typed `SeoFields`.
 *
 * Expected format:
 * ```
 * META_TITLE: …
 * META_DESCRIPTION: …
 * KEYWORDS: kw1, kw2, …
 * OG_TITLE: …
 * OG_DESCRIPTION: …
 * ```
 */
export function parseSeoOutput(output: string): SeoFields {
  const keywordsRaw = extractValue(output, 'KEYWORDS');

  return {
    metaTitle: extractValue(output, 'META_TITLE'),
    metaDescription: extractValue(output, 'META_DESCRIPTION'),
    keywords: keywordsRaw
      ? keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean)
      : [],
    ogTitle: extractValue(output, 'OG_TITLE'),
    ogDescription: extractValue(output, 'OG_DESCRIPTION'),
  };
}

// ---------------------------------------------------------------------------
// parseGeoOutput
// ---------------------------------------------------------------------------

/**
 * Parses the structured text output from the "Generate AI Discovery Content"
 * AI action into typed `GeoFields`.
 *
 * Expected format:
 * ```
 * AI_SUMMARY: …
 *
 * BEST_FOR:
 * - item
 *
 * SEARCH_INTENTS:
 * - item
 *
 * KEY_POINTS:
 * - item
 *
 * DIFFERENTIATORS:
 * - item
 *
 * COMPETITORS:
 * - item
 *
 * FAQ:
 * Q: …
 * A: …
 * ```
 */
export function parseGeoOutput(output: string): GeoFields {
  return {
    aiSummary: extractValue(output, 'AI_SUMMARY'),
    aiBestFor: extractListItems(output, 'BEST_FOR'),
    aiIntents: extractListItems(output, 'SEARCH_INTENTS'),
    aiKeyPoints: extractListItems(output, 'KEY_POINTS'),
    aiDifferentiators: extractListItems(output, 'DIFFERENTIATORS'),
    aiCompetitors: extractListItems(output, 'COMPETITORS'),
    aiFaq: parseFaqBlock(output),
  };
}

function parseFaqBlock(output: string): Array<{ question: string; answer: string }> {
  const faqMatch = output.match(/^FAQ:\s*\n([\s\S]*?)(?:\n\n[A-Z_]+:|$)/m);
  if (!faqMatch?.[1]) return [];

  const pairs: Array<{ question: string; answer: string }> = [];
  const lines = faqMatch[1].split('\n');

  let currentQ = '';
  for (const line of lines) {
    const qMatch = line.match(/^Q:\s*(.+)/);
    const aMatch = line.match(/^A:\s*(.+)/);
    if (qMatch) {
      currentQ = qMatch[1].trim();
    } else if (aMatch && currentQ) {
      pairs.push({ question: currentQ, answer: aMatch[1].trim() });
      currentQ = '';
    }
  }

  return pairs;
}
