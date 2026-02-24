import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { ScrapedPage } from '@etl-tools/shared';
import { extractBranding } from '../extractors/branding';
import { extractTaxonomy } from '../extractors/taxonomy';
import { extractSections } from '../extractors/sections';
import { extractImages } from '../extractors/assets';
import { makeAbsolute } from '../extractors/helpers';

export interface PlaywrightOptions {
  waitForSelector?: string;
  waitMs?: number;
  scrollToBottom?: boolean;
  viewport?: { width: number; height: number };
}

const DEFAULT_OPTIONS: PlaywrightOptions = {
  waitMs: 5000,
  scrollToBottom: true,
  viewport: { width: 1440, height: 900 },
};

export async function scrapeWithPlaywright(
  url: string,
  options?: PlaywrightOptions
): Promise<ScrapedPage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: opts.viewport,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
      javaScriptEnabled: true,
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 10000 }).catch(() => {});
    }

    if (opts.waitMs) {
      await page.waitForTimeout(opts.waitMs);
    }

    if (opts.scrollToBottom) {
      await autoScroll(page);
    }

    const html = await page.content();
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
    const contentSelectors = ['main', 'article', '.content', '.main-content', '#content', '[role="main"]'];
    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length) {
        bodyText = content.text().replace(/\s+/g, ' ').trim().slice(0, 1000);
        break;
      }
    }
    if (!bodyText) {
      const paragraphs: string[] = [];
      $('p').slice(0, 5).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) paragraphs.push(text);
      });
      bodyText = paragraphs.join(' ').slice(0, 1000);
    }

    const heroSubtitle = $('.hero p, [class*="hero"] p, .banner p, [class*="banner"] p')
      .first()
      .text()
      .trim() || undefined;
    const heroCtaEl = $('.hero a, [class*="hero"] a, .banner a, [class*="banner"] a').first();
    const heroCtaText = heroCtaEl.text().trim() || undefined;
    const heroCtaLink = heroCtaEl.attr('href')
      ? makeAbsolute(heroCtaEl.attr('href')!, baseUrl)
      : undefined;

    const branding = extractBranding(html, $, baseUrl);
    const taxonomyHints = extractTaxonomy(html, $, url);
    const sections = extractSections($);
    const images = extractImages($, baseUrl);

    await browser.close();

    return {
      url,
      slug,
      title: h1 || title.split('|')[0].trim(),
      h1,
      description: metaDescription || ogDescription || bodyText.slice(0, 300) || '',
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
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function autoScroll(page: any): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const maxScrolls = 20;
      let scrollCount = 0;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;
        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });
  await page.waitForTimeout(2000);
}
