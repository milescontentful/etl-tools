import * as cheerio from 'cheerio';
import type { ScrapedBranding } from '@etl-tools/shared';
import { makeAbsolute } from './helpers.js';

const LOGO_SELECTORS = [
  'header img[alt*="logo" i]',
  'header img[class*="logo" i]',
  'nav img[alt*="logo" i]',
  '.logo img',
  '#logo img',
  'a[href="/"] img',
  'header a img:first-child',
  'img[alt*="logo" i]',
  'img[class*="logo" i]',
  'img[src*="logo" i]',
];

const HERO_SELECTORS = [
  '.hero img',
  '.banner img',
  '[class*="hero"] img',
  '[class*="banner"] img',
  'section:first-of-type img',
  '.jumbotron img',
  '[style*="background-image"]',
];

const GENERIC_FONT_NAMES = new Set([
  'inherit', 'sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system',
]);

const IGNORED_COLORS = new Set([
  '#fff', '#ffffff', '#000', '#000000', '#333', '#333333',
]);

function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  for (const selector of LOGO_SELECTORS) {
    const el = $(selector).first();
    if (el.length) {
      const src = el.attr('src') || el.attr('data-src');
      if (src && !src.includes('tracking') && !src.includes('pixel')) {
        return makeAbsolute(src, baseUrl);
      }
    }
  }
  return undefined;
}

function extractFavicon($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  const el =
    $('link[rel="icon"]').first().length ? $('link[rel="icon"]').first() :
    $('link[rel="shortcut icon"]').first().length ? $('link[rel="shortcut icon"]').first() :
    $('link[rel="apple-touch-icon"]').first();

  const href = el.attr('href');
  return href ? makeAbsolute(href, baseUrl) : undefined;
}

function extractHeroImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  for (const selector of HERO_SELECTORS) {
    const el = $(selector).first();
    if (!el.length) continue;

    const src = el.attr('src') || el.attr('data-src');
    if (src) return makeAbsolute(src, baseUrl);

    const style = el.attr('style') || '';
    const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (bgMatch?.[1]) return makeAbsolute(bgMatch[1], baseUrl);
  }
  return undefined;
}

function extractColors($: cheerio.CheerioAPI): {
  primary?: string;
  secondary?: string;
  accent?: string;
} {
  const result: { primary?: string; secondary?: string; accent?: string } = {};

  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor) result.primary = themeColor;

  const styleContent = $('style').text();
  const colorMatches = styleContent.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)/g) || [];
  const counts: Record<string, number> = {};
  for (const c of colorMatches) {
    counts[c] = (counts[c] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .filter(c => !IGNORED_COLORS.has(c.toLowerCase()));

  if (!result.primary && sorted[0]) result.primary = sorted[0];
  if (sorted[1]) result.secondary = sorted[1];
  if (sorted[2]) result.accent = sorted[2];

  return result;
}

function extractFonts($: cheerio.CheerioAPI): { heading?: string; body?: string } {
  const families: string[] = [];
  const styleContent = $('style').text();

  const inlineMatches = styleContent.match(/font-family:\s*['"]?([^;'"]+)['"]?/gi) || [];
  for (const match of inlineMatches) {
    const name = match.replace(/font-family:\s*/i, '').replace(/['";]/g, '').trim().split(',')[0].trim();
    if (name && !families.includes(name) && !GENERIC_FONT_NAMES.has(name.toLowerCase())) {
      families.push(name);
    }
  }

  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const familyMatches = href.match(/family=([^&:]+)/g) || [];
    for (const match of familyMatches) {
      const name = decodeURIComponent(match.replace('family=', '').replace(/\+/g, ' '));
      if (name && !families.includes(name)) families.push(name);
    }
  });

  const fontFaceMatches = styleContent.match(/@font-face\s*{[^}]*font-family:\s*['"]?([^'";}]+)/gi) || [];
  for (const match of fontFaceMatches) {
    const nameMatch = match.match(/font-family:\s*['"]?([^'";}]+)/i);
    if (nameMatch?.[1]) {
      const name = nameMatch[1].trim();
      if (!families.includes(name)) families.push(name);
    }
  }

  return {
    heading: families[0],
    body: families[1] ?? families[0],
  };
}

function extractProductImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const productImages: string[] = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (!src) return;

    const absoluteUrl = makeAbsolute(src, baseUrl);
    const alt = ($(el).attr('alt') || '').toLowerCase();
    const className = ($(el).attr('class') || '').toLowerCase();
    const parentClass = ($(el).parent().attr('class') || '').toLowerCase();
    const width = parseInt($(el).attr('width') || '0', 10);
    const height = parseInt($(el).attr('height') || '0', 10);

    if (isTrackingPixel(absoluteUrl, width, height)) return;

    const isProduct =
      alt.includes('product') ||
      className.includes('product') ||
      parentClass.includes('product') ||
      absoluteUrl.includes('product') ||
      absoluteUrl.includes('/wp-content/uploads/') ||
      (width > 200 && height > 200);

    if (isProduct) productImages.push(absoluteUrl);
  });

  return [...new Set(productImages)].slice(0, 10);
}

function isTrackingPixel(url: string, width: number, height: number): boolean {
  return (
    url.includes('tracking') ||
    url.includes('pixel') ||
    url.includes('1x1') ||
    url.includes('spacer') ||
    (url.includes('.gif') && (width < 10 || height < 10)) ||
    url.includes('data:image')
  );
}

export function extractBranding(
  html: string,
  $: cheerio.CheerioAPI,
  baseUrl: string,
): ScrapedBranding {
  const colors = extractColors($);
  const fonts = extractFonts($);
  const heroImageUrl = extractHeroImage($, baseUrl);

  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();

  return {
    logoUrl: extractLogo($, baseUrl),
    faviconUrl: extractFavicon($, baseUrl),
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
    heroImageUrl: heroImageUrl ?? (ogImage ? makeAbsolute(ogImage, baseUrl) : undefined),
    productImages: extractProductImages($, baseUrl),
  };
}
