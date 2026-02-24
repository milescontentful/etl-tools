import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import {
  HarvestConfig,
  HarvestOutput,
  ScrapedPage,
  AssetManifestEntry,
  ScrapedBranding,
} from '@etl-tools/shared';
import { log } from '@etl-tools/shared';
import { scrapeWithCheerio } from './adapters/cheerio';
import { categorizeImage } from './extractors/assets';

export { scrapeWithCheerio } from './adapters/cheerio';
export * from './extractors';

export async function harvest(config: HarvestConfig, outputDir: string): Promise<HarvestOutput> {
  log.heading(`Harvesting: ${config.name}`);
  log.info(`${config.urls.length} URL(s) to process`);

  const pages: ScrapedPage[] = [];
  const assets: AssetManifestEntry[] = [];
  let branding: ScrapedBranding | null = null;

  const pagesDir = path.join(outputDir, 'harvest', 'pages');
  const assetsDir = path.join(outputDir, 'harvest', 'assets');
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  for (const urlEntry of config.urls) {
    const spin = log.spinner(`Scraping ${urlEntry.url}`);
    try {
      const page = await scrapeWithCheerio(urlEntry.url);
      pages.push(page);

      const pageFile = path.join(pagesDir, `${page.slug.replace(/\//g, '_')}.json`);
      fs.writeFileSync(pageFile, JSON.stringify(page, null, 2));

      if (urlEntry.type === 'homepage' && page.branding) {
        branding = page.branding;
      }

      if (config.options?.downloadAssets !== false) {
        for (const imageUrl of page.images) {
          const fileName = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg';
          const category = categorizeImage(
            imageUrl,
            '',
            '',
            '',
            0,
            0
          );
          assets.push({
            originalUrl: imageUrl,
            localPath: path.join('harvest', 'assets', fileName),
            fileName,
            contentType: guessContentType(fileName),
            category,
          });
        }
      }

      spin.succeed(`Scraped: ${page.title} (${page.images.length} images)`);
    } catch (err) {
      spin.fail(`Failed: ${urlEntry.url} — ${(err as Error).message}`);
    }
  }

  if (branding) {
    const brandingFile = path.join(outputDir, 'harvest', 'branding.json');
    fs.writeFileSync(brandingFile, JSON.stringify(branding, null, 2));
    log.success('Saved branding.json');
  }

  const output: HarvestOutput = {
    config,
    pages,
    branding,
    assets,
    timestamp: new Date().toISOString(),
  };

  const manifestFile = path.join(outputDir, 'harvest', 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify(output, null, 2));
  log.success(`Harvest complete: ${pages.length} pages, ${assets.length} assets`);

  return output;
}

function guessContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ico: 'image/x-icon',
  };
  return map[ext || ''] || 'application/octet-stream';
}

export async function downloadAsset(
  url: string,
  destPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadAsset(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}
