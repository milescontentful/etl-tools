import * as cheerio from 'cheerio';
import type { TaxonomyHints } from '@etl-tools/shared';

const BREADCRUMB_SELECTORS = [
  'nav[aria-label="breadcrumb"] a',
  'nav[aria-label="breadcrumb"] span',
  '.breadcrumb a',
  '.breadcrumb span',
  '.breadcrumbs a',
  '.breadcrumbs span',
  '[itemtype*="BreadcrumbList"] [itemprop="name"]',
  'ol.breadcrumb li',
  'ul.breadcrumb li',
];

const CATEGORY_META_SELECTORS = [
  'meta[property="article:section"]',
  'meta[property="product:category"]',
  'meta[name="category"]',
  'meta[name="keywords"]',
];

const CONCEPT_MAPPINGS: Record<string, string[]> = {
  airlink: ['airlink-routers'],
  router: ['airlink-routers'],
  xr: ['xr-series', 'airlink-routers'],
  rv: ['rv-series', 'airlink-routers'],
  module: ['iot-modules'],
  hl: ['hl-series', 'iot-modules'],
  wp: ['wp-series', 'iot-modules'],
  gateway: ['iot-gateways'],
  connectivity: ['smart-connectivity'],
  esim: ['smart-connectivity'],
  fleet: ['transportation'],
  vehicle: ['transportation'],
  transit: ['transportation'],
  industrial: ['industrial-iot'],
  manufacturing: ['industrial-iot'],
  enterprise: ['enterprise'],
  business: ['enterprise'],
  safety: ['public-safety'],
  'first responder': ['public-safety'],
  emergency: ['public-safety'],
  energy: ['energy-utilities'],
  utility: ['energy-utilities'],
  grid: ['energy-utilities'],
};

function extractBreadcrumbs($: cheerio.CheerioAPI): string[] {
  const breadcrumbs: string[] = [];

  for (const selector of BREADCRUMB_SELECTORS) {
    const els = $(selector);
    if (els.length === 0) continue;

    els.each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length < 100 && !breadcrumbs.includes(text)) {
        breadcrumbs.push(text);
      }
    });

    if (breadcrumbs.length > 0) break;
  }

  return breadcrumbs;
}

function extractMetaCategories($: cheerio.CheerioAPI): string[] {
  const categories: string[] = [];

  for (const selector of CATEGORY_META_SELECTORS) {
    const content = $(selector).attr('content');
    if (content) {
      const parts = content.split(',').map(c => c.trim()).filter(c => c.length > 0 && c.length < 50);
      categories.push(...parts);
    }
  }

  return [...new Set(categories)].slice(0, 10);
}

function extractSchemaOrg($: cheerio.CheerioAPI): { categories: string[]; breadcrumbs: string[] } {
  const categories: string[] = [];
  const breadcrumbs: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json['@type'] === 'Product' && json.category) {
        const cats = Array.isArray(json.category) ? json.category : [json.category];
        categories.push(...cats.filter((c: unknown) => typeof c === 'string'));
      }
      if (json['@type'] === 'BreadcrumbList' && json.itemListElement) {
        for (const item of json.itemListElement) {
          if (item.name && typeof item.name === 'string') {
            breadcrumbs.push(item.name);
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  return { categories, breadcrumbs };
}

function suggestConcepts(hints: string[]): string[] {
  const lower = hints.map(h => h.toLowerCase());
  const concepts = new Set<string>();

  for (const hint of lower) {
    for (const [keyword, mapped] of Object.entries(CONCEPT_MAPPINGS)) {
      if (hint.includes(keyword)) {
        for (const c of mapped) concepts.add(c);
      }
    }
  }

  return Array.from(concepts);
}

export function extractTaxonomy(
  html: string,
  $: cheerio.CheerioAPI,
  url: string,
): TaxonomyHints {
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname.split('/').filter(Boolean);

  const breadcrumbs = extractBreadcrumbs($);
  const metaCategories = extractMetaCategories($);
  const schema = extractSchemaOrg($);

  metaCategories.push(...schema.categories);
  for (const b of schema.breadcrumbs) {
    if (!breadcrumbs.includes(b)) breadcrumbs.push(b);
  }

  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const allHints = [...breadcrumbs, ...urlPath, ...metaCategories, h1, title];

  return {
    breadcrumbs,
    urlPath,
    metaCategories: [...new Set(metaCategories)].slice(0, 10),
    suggestedConcepts: suggestConcepts(allHints),
  };
}
