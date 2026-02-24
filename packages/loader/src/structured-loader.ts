import { PlainClientAPI } from 'contentful-management';
import {
  NextDataPayload,
  NextDataProduct,
  NextDataNavItem,
  NextDataHeroBanner,
  NextDataBrandLogo,
  log,
} from '@etl-tools/shared';
import { uploadAsset } from './asset-uploader';
import { createAndPublishEntry, localize, makeLink } from './entry-creator';

const MAX_ENTRIES_WARNING = 300;

export interface StructuredLoadResult {
  productEntries: number;
  productSectionEntries: number;
  navEntries: number;
  heroEntries: number;
  footerEntries: number;
  brandEntries: number;
  assetCount: number;
  totalEntries: number;
  pageId?: string;
  siteSettingsId?: string;
}

export async function loadStructuredData(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  data: NextDataPayload,
  pageName: string
): Promise<StructuredLoadResult> {
  const result: StructuredLoadResult = {
    productEntries: 0,
    productSectionEntries: 0,
    navEntries: 0,
    heroEntries: 0,
    footerEntries: 0,
    brandEntries: 0,
    assetCount: 0,
    totalEntries: 0,
  };

  const estimated =
    data.products.length +
    Math.ceil(data.products.length / 4) +
    data.navigation.length +
    data.navigation.reduce((sum, n) => sum + (n.children?.length || 0), 0) +
    data.heroBanners.length +
    data.footerLinks.length +
    data.brandLogos.length + 3;

  log.heading(`Structured Data Loader`);
  log.info(`Estimated entries: ${estimated}`);

  if (estimated > MAX_ENTRIES_WARNING) {
    log.warn(`Entry count (${estimated}) exceeds ${MAX_ENTRIES_WARNING}. Proceeding with top-level items only.`);
  }

  // 1. Hero banners
  const heroIds: string[] = [];
  if (data.heroBanners.length > 0) {
    log.heading(`Creating ${data.heroBanners.length} Hero Banners`);
    for (const banner of data.heroBanners) {
      const spin = log.spinner(`Hero: ${banner.headline.slice(0, 50)}`);
      try {
        let imageAssetId: string | undefined;
        if (banner.imageDesktop) {
          try {
            imageAssetId = await uploadAsset(client, spaceId, environmentId, {
              title: `Hero — ${banner.altText.slice(0, 60)}`,
              fileName: banner.imageDesktop.split('/').pop()?.split('?')[0] || 'hero.jpg',
              contentType: 'image/jpeg',
              uploadUrl: banner.imageDesktop,
            });
            result.assetCount++;
          } catch { /* non-fatal */ }
        }

        const fields: Record<string, unknown> = {
          internalName: localize(`Hero — ${banner.headline.slice(0, 80)}`),
          headline: localize(banner.headline.slice(0, 100) || pageName),
          textAlign: localize('center'),
          heroSize: localize('tall'),
          colorPalette: localize('brand-primary'),
        };
        if (banner.linkUrl) {
          fields.ctaText = localize('Learn More');
          fields.ctaLink = localize(banner.linkUrl);
        }
        if (imageAssetId) {
          fields.image = localize(makeLink(imageAssetId, 'Asset'));
        }

        const heroId = await createAndPublishEntry(client, spaceId, environmentId, 'heroSection', fields);
        heroIds.push(heroId);
        result.heroEntries++;
        spin.succeed(`Hero: ${banner.headline.slice(0, 50)} (${heroId})`);
      } catch (err) {
        spin.fail(`Hero: ${(err as Error).message}`);
      }
    }
  }

  // 2. Products -> sectionItems grouped into sections
  const sectionIds: string[] = [];
  if (data.products.length > 0) {
    log.heading(`Creating ${data.products.length} Product Entries`);
    const chunkSize = 4;
    const chunks: NextDataProduct[][] = [];
    for (let i = 0; i < data.products.length; i += chunkSize) {
      chunks.push(data.products.slice(i, i + chunkSize));
    }

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const itemIds: string[] = [];

      for (const product of chunk) {
        const spin = log.spinner(`Product: ${product.name.slice(0, 50)}`);
        try {
          let imageAssetId: string | undefined;
          if (product.imageUrl) {
            try {
              imageAssetId = await uploadAsset(client, spaceId, environmentId, {
                title: product.name.slice(0, 80),
                fileName: `${product.slug || product.sku}.jpg`,
                contentType: 'image/jpeg',
                uploadUrl: product.imageUrl,
              });
              result.assetCount++;
            } catch { /* non-fatal */ }
          }

          const description = [
            product.price ? `$${product.price}` : '',
            product.offerFlag || '',
            product.shortDescription?.slice(0, 150) || '',
          ].filter(Boolean).join(' — ');

          const fields: Record<string, unknown> = {
            title: localize(product.name),
            description: localize(description),
            link: localize(product.url),
          };

          const itemId = await createAndPublishEntry(client, spaceId, environmentId, 'sectionItem', fields);
          itemIds.push(itemId);
          result.productEntries++;
          spin.succeed(`${product.name.slice(0, 40)} — $${product.price}`);
        } catch (err) {
          spin.fail(`${product.name.slice(0, 40)}: ${(err as Error).message}`);
        }
      }

      if (itemIds.length > 0) {
        const sectionTitle = ci === 0 ? 'Featured Products' : `Products — Row ${ci + 1}`;
        try {
          const sectionId = await createAndPublishEntry(client, spaceId, environmentId, 'section', {
            internalName: localize(sectionTitle),
            title: localize(sectionTitle),
            items: localize(itemIds.map((id) => makeLink(id))),
          });
          sectionIds.push(sectionId);
          result.productSectionEntries++;
          log.success(`Section: ${sectionTitle} (${itemIds.length} products)`);
        } catch (err) {
          log.error(`Section: ${(err as Error).message}`);
        }
      }
    }
  }

  // 3. Navigation items (top 2 levels)
  const navItemIds: string[] = [];
  if (data.navigation.length > 0) {
    log.heading(`Creating ${data.navigation.length} Navigation Items`);
    for (const navItem of data.navigation) {
      const spin = log.spinner(`Nav: ${navItem.label}`);
      try {
        const navId = await createAndPublishEntry(client, spaceId, environmentId, 'navigationItem', {
          label: localize(navItem.label),
          slug: localize(navItem.url),
          isExternal: localize(false),
        });
        navItemIds.push(navId);
        result.navEntries++;
        spin.succeed(`Nav: ${navItem.label} (${navId})`);

        if (navItem.children && navItem.children.length > 0) {
          for (const child of navItem.children.slice(0, 8)) {
            try {
              const childId = await createAndPublishEntry(client, spaceId, environmentId, 'navigationItem', {
                label: localize(child.label),
                slug: localize(child.url),
                isExternal: localize(false),
              });
              navItemIds.push(childId);
              result.navEntries++;
              log.dim(`  └ ${child.label}`);
            } catch { /* skip child failures */ }
          }
        }
      } catch (err) {
        spin.fail(`Nav: ${navItem.label} — ${(err as Error).message}`);
      }
    }
  }

  // 4. Footer links
  const footerNavIds: string[] = [];
  if (data.footerLinks.length > 0) {
    log.heading(`Creating ${data.footerLinks.length} Footer Links`);
    for (const link of data.footerLinks) {
      try {
        const linkId = await createAndPublishEntry(client, spaceId, environmentId, 'navigationItem', {
          label: localize(link.label),
          slug: localize(link.url),
          isExternal: localize(link.url.startsWith('http')),
        });
        footerNavIds.push(linkId);
        result.footerEntries++;
        log.dim(`Footer: ${link.label}`);
      } catch { /* skip failures */ }
    }
  }

  // 5. Brand logos
  if (data.brandLogos.length > 0) {
    log.heading(`Creating ${data.brandLogos.length} Brand Logos`);
    const brandItemIds: string[] = [];
    for (const brand of data.brandLogos) {
      try {
        const brandId = await createAndPublishEntry(client, spaceId, environmentId, 'sectionItem', {
          title: localize(brand.name),
          link: localize(brand.linkUrl),
          description: localize(`Brand partner: ${brand.name}`),
        });
        brandItemIds.push(brandId);
        result.brandEntries++;
        log.dim(`Brand: ${brand.name}`);
      } catch { /* skip */ }
    }

    if (brandItemIds.length > 0) {
      try {
        const brandSectionId = await createAndPublishEntry(client, spaceId, environmentId, 'section', {
          internalName: localize('Trusted Brands'),
          title: localize('Our Trusted Brands'),
          items: localize(brandItemIds.map((id) => makeLink(id))),
        });
        sectionIds.push(brandSectionId);
        log.success(`Brand section created (${brandItemIds.length} brands)`);
      } catch { /* skip */ }
    }
  }

  // 6. Page entry
  log.heading('Creating Page Entry');
  try {
    const pageFields: Record<string, unknown> = {
      title: localize(pageName),
      slug: localize('home'),
      sourceUrl: localize('harveynorman.com.au'),
    };
    if (heroIds.length > 0) {
      pageFields.heroSection = localize(makeLink(heroIds[0]));
    }
    if (sectionIds.length > 0) {
      pageFields.sections = localize(sectionIds.map((id) => makeLink(id)));
    }

    result.pageId = await createAndPublishEntry(client, spaceId, environmentId, 'page', pageFields);
    log.success(`Page: ${pageName} (${result.pageId})`);
  } catch (err) {
    log.error(`Page: ${(err as Error).message}`);
  }

  result.totalEntries =
    result.heroEntries +
    result.productEntries +
    result.productSectionEntries +
    result.navEntries +
    result.footerEntries +
    result.brandEntries + 1;

  log.heading('Load Summary');
  log.table([
    ['Hero Banners', String(result.heroEntries)],
    ['Products', String(result.productEntries)],
    ['Product Sections', String(result.productSectionEntries)],
    ['Navigation Items', String(result.navEntries)],
    ['Footer Links', String(result.footerEntries)],
    ['Brand Entries', String(result.brandEntries)],
    ['Assets Uploaded', String(result.assetCount)],
    ['Total Entries', String(result.totalEntries)],
  ]);

  return result;
}
