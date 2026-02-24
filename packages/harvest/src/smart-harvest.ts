import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { detectStrategy, formatDetectionReport, DetectionResult } from './auto-detect';
import { extractBranding } from './extractors/branding';
import { extractNextData } from './extractors/next-data';

export interface SmartHarvestConfig {
  name: string;
  urls: Array<{ url: string; type?: string; htmlFile?: string }>;
  outputDir?: string;
}

export interface SmartHarvestResult {
  url: string;
  detection: DetectionResult;
  structuredData?: any;
  branding?: any;
  html?: string;
  error?: string;
}

export async function smartHarvest(config: SmartHarvestConfig): Promise<SmartHarvestResult[]> {
  const results: SmartHarvestResult[] = [];
  const outputDir = config.outputDir || path.join(process.cwd(), 'output', 'harvest');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n  ═══════════════════════════════════════════`);
  console.log(`  Smart Harvest: ${config.name}`);
  console.log(`  Analyzing ${config.urls.length} URL(s)...`);
  console.log(`  ═══════════════════════════════════════════\n`);

  for (const entry of config.urls) {
    const result: SmartHarvestResult = {
      url: entry.url,
      detection: {} as DetectionResult,
    };

    try {
      let html: string;

      if (entry.htmlFile) {
        // Load from saved HTML file
        html = fs.readFileSync(path.resolve(entry.htmlFile), 'utf-8');
        console.log(`  Loading saved HTML: ${entry.htmlFile} (${(html.length / 1024).toFixed(0)} KB)`);
      } else {
        // Fetch with Playwright
        console.log(`  Fetching: ${entry.url}`);
        html = await fetchWithPlaywright(entry.url);
      }

      result.html = html;

      // Auto-detect framework and strategy
      result.detection = detectStrategy(html, entry.url);
      console.log(formatDetectionReport(entry.url, result.detection));

      // Extract based on strategy
      const baseUrl = new URL(entry.url).origin;

      switch (result.detection.strategy) {
        case 'nextjs': {
          const nextData = extractNextData(html, baseUrl);
          if (nextData) {
            result.structuredData = nextData;
            console.log(`    Extracted: ${nextData.products.length} products, ${nextData.navigation.length} nav items`);
          }
          break;
        }
        case 'nuxtjs': {
          console.log(`    Nuxt.js detected — __NUXT__ parser coming soon`);
          break;
        }
        case 'blocked': {
          console.log(`    Site blocked. Save HTML from browser and use htmlFile option.`);
          break;
        }
        default: {
          // Fall back to branding extraction for any site
          const $ = cheerio.load(html);
          result.branding = extractBranding(html, $, baseUrl);
          console.log(`    Branding extracted: ${result.branding.primaryColor || 'no color'}, ${result.branding.headingFont || 'no font'}`);
        }
      }

      // Save individual result
      const slug = new URL(entry.url).hostname.replace(/\./g, '-');
      fs.writeFileSync(
        path.join(outputDir, `${slug}-analysis.json`),
        JSON.stringify({
          url: entry.url,
          detection: result.detection,
          structuredDataSummary: result.structuredData ? {
            products: result.structuredData.products?.length || 0,
            navigation: result.structuredData.navigation?.length || 0,
            heroBanners: result.structuredData.heroBanners?.length || 0,
            footerLinks: result.structuredData.footerLinks?.length || 0,
            brandLogos: result.structuredData.brandLogos?.length || 0,
          } : null,
          branding: result.branding ? {
            primaryColor: result.branding.primaryColor,
            headingFont: result.branding.headingFont,
            logoUrl: result.branding.logoUrl,
          } : null,
        }, null, 2)
      );

    } catch (err) {
      result.error = (err as Error).message;
      result.detection = {
        strategy: 'blocked',
        hasStructuredData: false,
        hasProducts: false,
        hasNavigation: false,
        pageSize: 0,
        confidence: 'low',
        recommendation: `Error: ${result.error}`,
      };
      console.log(`  ERROR: ${entry.url} — ${result.error}`);
    }

    results.push(result);
    console.log('');
  }

  // Summary
  console.log(`  ═══════════════════════════════════════════`);
  console.log(`  Analysis Complete`);
  console.log(`  ─────────────────────────────────────────`);
  for (const r of results) {
    const host = new URL(r.url).hostname;
    const products = r.structuredData?.products?.length || 0;
    const status = r.error ? 'ERROR' : r.detection.strategy.toUpperCase();
    console.log(`  ${host.padEnd(30)} ${status.padEnd(12)} ${products > 0 ? products + ' products' : r.detection.recommendation.slice(0, 40)}`);
  }
  console.log(`  ═══════════════════════════════════════════\n`);

  return results;
}

async function fetchWithPlaywright(url: string): Promise<string> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(8000);
    const html = await page.content();
    await browser.close();
    return html;
  } catch (err) {
    await browser.close();
    throw err;
  }
}
