import { PlainClientAPI } from 'contentful-management';
import { ScrapedPage, HarvestOutput, log } from '@etl-tools/shared';
import { uploadAsset } from './asset-uploader';
import { createAndPublishEntry, localize, makeLink } from './entry-creator';
import {
  findAiActions,
  generateSeo,
  generateGeo,
  createSeoEntry,
  createGeoEntry,
} from './ai-enrichment';

export interface LoadOptions {
  spaceId: string;
  environmentId: string;
  enableSeo?: boolean;
  enableGeo?: boolean;
}

export interface PageLoadResult {
  url: string;
  pageId: string;
  heroId?: string;
  seoId?: string;
  geoId?: string;
  sectionIds: string[];
  assetIds: string[];
  error?: string;
}

export async function loadHarvestOutput(
  client: PlainClientAPI,
  harvestOutput: HarvestOutput,
  options: LoadOptions
): Promise<PageLoadResult[]> {
  const { spaceId, environmentId } = options;
  const results: PageLoadResult[] = [];

  log.heading(`Loading ${harvestOutput.pages.length} pages into Contentful`);
  log.info(`Space: ${spaceId} | Environment: ${environmentId}`);

  let aiActions = { seoActionId: undefined as string | undefined, geoActionId: undefined as string | undefined };
  if (options.enableSeo || options.enableGeo) {
    const spin = log.spinner('Finding AI Actions...');
    aiActions = await findAiActions(client, spaceId, environmentId);
    if (aiActions.seoActionId || aiActions.geoActionId) {
      spin.succeed(`Found AI Actions (SEO: ${aiActions.seoActionId ? 'yes' : 'no'}, GEO: ${aiActions.geoActionId ? 'yes' : 'no'})`);
    } else {
      spin.warn('No AI Actions found — run create-demo first to set them up');
    }
  }

  if (harvestOutput.branding) {
    const spin = log.spinner('Creating Brand Settings...');
    try {
      const b = harvestOutput.branding;
      await createAndPublishEntry(client, spaceId, environmentId, 'brandSettings', {
        internalName: localize(`${harvestOutput.config.name} Brand`),
        primaryColor: localize(b.primaryColor || '#0066CC'),
        secondaryColor: localize(b.secondaryColor || '#1A1A2E'),
        headingFont: localize(b.headingFont || 'Inter'),
        bodyFont: localize(b.bodyFont || 'Inter'),
        borderRadius: localize(b.borderRadius || 'small'),
      });
      spin.succeed('Brand Settings created');
    } catch (err) {
      spin.warn(`Brand Settings: ${(err as Error).message}`);
    }
  }

  for (const page of harvestOutput.pages) {
    const result = await loadSinglePage(client, page, options, aiActions);
    results.push(result);
  }

  const succeeded = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  log.heading(`Load complete: ${succeeded} succeeded, ${failed} failed`);

  return results;
}

async function loadSinglePage(
  client: PlainClientAPI,
  page: ScrapedPage,
  options: LoadOptions,
  aiActions: { seoActionId?: string; geoActionId?: string }
): Promise<PageLoadResult> {
  const { spaceId, environmentId } = options;
  const result: PageLoadResult = {
    url: page.url,
    pageId: '',
    sectionIds: [],
    assetIds: [],
  };

  const spin = log.spinner(`Loading: ${page.title}`);

  try {
    let heroImageAssetId: string | undefined;
    const heroImageUrl = page.branding?.heroImageUrl || page.ogImage || page.images[0];
    if (heroImageUrl) {
      try {
        heroImageAssetId = await uploadAsset(client, spaceId, environmentId, {
          title: `${page.title} — Hero Image`,
          fileName: heroImageUrl.split('/').pop()?.split('?')[0] || 'hero.jpg',
          contentType: guessContentType(heroImageUrl),
          uploadUrl: heroImageUrl,
        });
        result.assetIds.push(heroImageAssetId);
      } catch {
        // non-fatal
      }
    }

    const heroFields: Record<string, unknown> = {
      internalName: localize(`Hero — ${page.title}`),
      headline: localize(page.h1 || page.title),
      bodyText: localize(page.heroSubtitle || page.description?.slice(0, 200) || ''),
      textAlign: localize('left'),
      heroSize: localize('standard'),
      colorPalette: localize('brand-primary'),
    };
    if (page.heroCtaText) {
      heroFields.ctaText = localize(page.heroCtaText);
      heroFields.ctaLink = localize(page.heroCtaLink || '#');
    }
    if (heroImageAssetId) {
      heroFields.image = localize(makeLink(heroImageAssetId, 'Asset'));
    }

    const heroId = await createAndPublishEntry(
      client, spaceId, environmentId, 'heroSection', heroFields
    );
    result.heroId = heroId;

    const sectionEntryIds: string[] = [];
    if (page.sections && page.sections.length > 0) {
      for (const section of page.sections.slice(0, 10)) {
        const itemIds: string[] = [];
        for (const item of section.items.slice(0, 10)) {
          const itemId = await createAndPublishEntry(
            client, spaceId, environmentId, 'sectionItem', {
              title: localize(item.name),
              description: localize(item.description || ''),
              link: localize(item.link || ''),
            }
          );
          itemIds.push(itemId);
        }

        const sectionId = await createAndPublishEntry(
          client, spaceId, environmentId, 'section', {
            internalName: localize(`Section — ${section.title}`),
            title: localize(section.title),
            items: localize(itemIds.map((id) => makeLink(id))),
          }
        );
        sectionEntryIds.push(sectionId);
        result.sectionIds.push(sectionId);
      }
    }

    let seoId: string | undefined;
    if (options.enableSeo && aiActions.seoActionId) {
      try {
        const seo = await generateSeo(
          client, spaceId, environmentId,
          aiActions.seoActionId, page.title, page.description
        );
        seoId = await createSeoEntry(client, spaceId, environmentId, seo);
        result.seoId = seoId;
      } catch (err) {
        log.warn(`SEO generation failed for ${page.title}: ${(err as Error).message}`);
      }
    }

    let geoId: string | undefined;
    if (options.enableGeo && aiActions.geoActionId) {
      try {
        const geo = await generateGeo(
          client, spaceId, environmentId,
          aiActions.geoActionId, page.title, page.description, 'General'
        );
        geoId = await createGeoEntry(client, spaceId, environmentId, geo);
        result.geoId = geoId;
      } catch (err) {
        log.warn(`GEO generation failed for ${page.title}: ${(err as Error).message}`);
      }
    }

    const pageFields: Record<string, unknown> = {
      title: localize(page.title),
      slug: localize(page.slug),
      sourceUrl: localize(page.url),
      heroSection: localize(makeLink(heroId)),
    };
    if (sectionEntryIds.length > 0) {
      pageFields.sections = localize(sectionEntryIds.map((id) => makeLink(id)));
    }
    if (seoId) {
      pageFields.seo = localize(makeLink(seoId));
    }
    if (geoId) {
      pageFields.geo = localize(makeLink(geoId));
    }

    const pageId = await createAndPublishEntry(
      client, spaceId, environmentId, 'page', pageFields
    );
    result.pageId = pageId;

    spin.succeed(`${page.title} — page:${pageId} hero:${heroId} sections:${sectionEntryIds.length}`);
  } catch (err) {
    result.error = (err as Error).message;
    spin.fail(`${page.title}: ${result.error}`);
  }

  return result;
}

function guessContentType(url: string): string {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    mp4: 'video/mp4', ico: 'image/x-icon',
  };
  return map[ext || ''] || 'image/jpeg';
}
