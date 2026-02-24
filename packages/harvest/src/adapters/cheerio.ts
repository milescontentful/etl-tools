import * as cheerio from 'cheerio';
import { ScrapedPage } from '@etl-tools/shared';
import { extractBranding } from '../extractors/branding';
import { extractTaxonomy } from '../extractors/taxonomy';
import { extractSections } from '../extractors/sections';
import { extractImages } from '../extractors/assets';
import { makeAbsolute } from '../extractors/helpers';

export async function scrapeWithCheerio(url: string): Promise<ScrapedPage> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const urlObj = new URL(url);
  const baseUrl = urlObj.origin;

  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const slug = pathParts.length > 0
    ? pathParts.join('/').replace(/#.*$/, '')
    : 'home';

  const title =
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    'Untitled';

  const h1 = $('h1').first().text().trim();

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || '';
  const metaTitle =
    $('meta[name="title"]').attr('content')?.trim() || title;
  const ogTitle =
    $('meta[property="og:title"]').attr('content')?.trim() || title;
  const ogDescription =
    $('meta[property="og:description"]').attr('content')?.trim() || metaDescription;
  const ogImage =
    $('meta[property="og:image"]').attr('content')?.trim() || '';

  let bodyText = '';
  const contentSelectors = ['main', 'article', '.content', '.main-content', '#content'];
  for (const selector of contentSelectors) {
    const content = $(selector).first();
    if (content.length) {
      bodyText = content.text().replace(/\s+/g, ' ').trim().slice(0, 500);
      break;
    }
  }
  if (!bodyText) {
    const paragraphs: string[] = [];
    $('p').slice(0, 3).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) paragraphs.push(text);
    });
    bodyText = paragraphs.join(' ').slice(0, 500);
  }

  const heroSubtitle = $('.hero p, [class*="hero"] p, .banner p')
    .first()
    .text()
    .trim() || undefined;
  const heroCtaEl = $('.hero a, [class*="hero"] a, .banner a').first();
  const heroCtaText = heroCtaEl.text().trim() || undefined;
  const heroCtaLink = heroCtaEl.attr('href')
    ? makeAbsolute(heroCtaEl.attr('href')!, baseUrl)
    : undefined;

  const branding = extractBranding(html, $, baseUrl);
  const taxonomyHints = extractTaxonomy(html, $, url);
  const sections = extractSections($);
  const images = extractImages($, baseUrl);

  return {
    url,
    slug,
    title: h1 || title.split('|')[0].trim(),
    h1,
    description: metaDescription || ogDescription || bodyText || '',
    bodyText,
    metaTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    ogImage: ogImage ? makeAbsolute(ogImage, baseUrl) : '',
    images,
    heroSubtitle,
    heroCtaText,
    heroCtaLink,
    sections,
    branding,
    taxonomyHints,
  };
}
