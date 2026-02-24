import * as cheerio from 'cheerio';
import { makeAbsolute } from './helpers.js';

export function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (!src) return;

    const absoluteUrl = makeAbsolute(src, baseUrl);
    if (!absoluteUrl || absoluteUrl.startsWith('data:')) return;

    const width = parseInt($(el).attr('width') || '0', 10);
    const height = parseInt($(el).attr('height') || '0', 10);

    if (isFiltered(absoluteUrl, width, height)) return;

    images.push(absoluteUrl);
  });

  return [...new Set(images)];
}

function isFiltered(url: string, width: number, height: number): boolean {
  return (
    url.includes('tracking') ||
    url.includes('pixel') ||
    url.includes('1x1') ||
    url.includes('spacer') ||
    (url.includes('.gif') && (width < 10 || height < 10))
  );
}

export function categorizeImage(
  url: string,
  alt: string,
  className: string,
  parentClass: string,
  width: number,
  height: number,
): 'logo' | 'hero' | 'product' | 'section' | 'icon' | 'other' {
  const lUrl = url.toLowerCase();
  const lAlt = alt.toLowerCase();
  const lClass = className.toLowerCase();
  const lParent = parentClass.toLowerCase();

  if (lAlt.includes('logo') || lClass.includes('logo') || lUrl.includes('logo')) {
    return 'logo';
  }

  if (lClass.includes('hero') || lParent.includes('hero') || lClass.includes('banner') || lParent.includes('banner')) {
    return 'hero';
  }

  if (
    lAlt.includes('product') ||
    lClass.includes('product') ||
    lParent.includes('product') ||
    lUrl.includes('product') ||
    lUrl.includes('/wp-content/uploads/') ||
    (width > 200 && height > 200)
  ) {
    return 'product';
  }

  if (lClass.includes('section') || lParent.includes('section') || lParent.includes('feature')) {
    return 'section';
  }

  if (
    lUrl.includes('icon') ||
    lAlt.includes('icon') ||
    lClass.includes('icon') ||
    (width > 0 && width <= 64 && height > 0 && height <= 64)
  ) {
    return 'icon';
  }

  return 'other';
}
