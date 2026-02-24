import * as cheerio from 'cheerio';
import {
  NextDataPayload,
  NextDataProduct,
  NextDataNavItem,
  NextDataHeroBanner,
  NextDataBrandLogo,
} from '@etl-tools/shared';

const MAX_NAV_DEPTH = 2;

export function extractNextData(html: string, baseUrl: string): NextDataPayload | undefined {
  const $ = cheerio.load(html);
  const scriptEl = $('#__NEXT_DATA__');
  if (!scriptEl.length) return undefined;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(scriptEl.html() || '{}');
  } catch {
    return undefined;
  }

  // Some Next.js sites nest pageProps inside another pageProps
  const outerProps = (raw as any)?.props?.pageProps;
  const pageProps = outerProps?.pageProps || outerProps;
  if (!pageProps) return undefined;

  return {
    source: 'next',
    products: extractProducts(pageProps, baseUrl),
    navigation: extractNavigation(pageProps),
    heroBanners: extractHeroBanners(pageProps),
    footerLinks: extractFooterLinks(pageProps),
    brandLogos: extractBrandLogos(pageProps),
    raw,
  };
}

function extractProducts(pageProps: any, baseUrl: string): NextDataProduct[] {
  const items = pageProps?.catalogData?.homeProducts?.items;
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => {
    const finalPrice = item.price_range?.minimum_price?.final_price;
    const discount = item.price_range?.minimum_price?.discount;
    const originalPrice = discount?.amount_off
      ? finalPrice?.value + discount.amount_off
      : undefined;

    return {
      name: item.name || '',
      sku: (item.sku || '').split(',')[0].trim(),
      slug: item.url_key || '',
      price: finalPrice?.value || 0,
      originalPrice,
      currency: finalPrice?.currency || 'AUD',
      imageUrl: item.small_image?.url || '',
      imageAlt: item.small_image?.label || item.name || '',
      rating: item.ratings?.average,
      reviewCount: item.ratings?.count,
      offerFlag: item.offers?.bonus?.type || item.promotion_data?.name,
      offerText: item.offers?.bonus?.title,
      shortDescription: stripHtml(item.short_description?.html),
      url: `${baseUrl}/${item.url_key}${item.url_suffix || '.html'}`,
    };
  });
}

function extractNavigation(pageProps: any): NextDataNavItem[] {
  const navContent = pageProps?.pageData?.atlasNav?.content;
  if (!navContent) return [];

  let navTree: any[];
  try {
    navTree = JSON.parse(navContent);
  } catch {
    return [];
  }

  const root = navTree[0]?.children;
  if (!Array.isArray(root)) return [];

  const mainNav = root[0]?.children;
  if (!Array.isArray(mainNav)) return [];

  return mainNav
    .filter((item: any) => item.group_type === '0' || item.group_type === 0)
    .map((item: any) => parseNavItem(item, 1))
    .filter((item: NextDataNavItem) => item.label && item.url);
}

function parseNavItem(item: any, depth: number): NextDataNavItem {
  const result: NextDataNavItem = {
    id: String(item.id || ''),
    label: item.title || '',
    url: item.url || '',
    level: depth,
  };

  if (depth < MAX_NAV_DEPTH && Array.isArray(item.children) && item.children.length > 0) {
    result.children = item.children
      .filter((child: any) => {
        const gt = Number(child.group_type);
        return gt === 0 && child.title && child.url;
      })
      .map((child: any) => parseNavItem(child, depth + 1));
  }

  return result;
}

function extractHeroBanners(pageProps: any): NextDataHeroBanner[] {
  const sliderItems = pageProps?.categoryData?.homeCmsSlider?.items;
  if (!Array.isArray(sliderItems)) return [];

  const banners: NextDataHeroBanner[] = [];

  for (const block of sliderItems) {
    const html = block.content || '';
    const $ = cheerio.load(html);

    $('div.hn-slide, .hn-slide').each((_, slideEl) => {
      const desktopImg = $(slideEl).find('img.hn-is-desktop, img').first();
      const mobileImg = $(slideEl).find('img.hn-is-mobile').first();
      const linkEl = $(slideEl).find('a').first();

      const imgSrc = desktopImg.attr('src');
      if (!imgSrc) return;

      banners.push({
        headline: desktopImg.attr('alt') || '',
        imageDesktop: imgSrc,
        imageMobile: mobileImg.attr('src') || undefined,
        linkUrl: linkEl.attr('href') || '',
        altText: desktopImg.attr('alt') || '',
      });
    });
  }

  return banners;
}

function extractFooterLinks(pageProps: any): NextDataNavItem[] {
  const footerItems = pageProps?.categoryData?.pageFooterNavigation?.items;
  if (!Array.isArray(footerItems)) return [];

  const links: NextDataNavItem[] = [];
  let id = 1;

  for (const block of footerItems) {
    const html = block.content || '';
    const $ = cheerio.load(html);

    $('footer a, .mega-footer a').each((_, el) => {
      const label = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (label && label.length > 1 && label.length < 60 && href) {
        links.push({
          id: `footer-${id++}`,
          label,
          url: href,
          level: 1,
        });
      }
    });
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.label)) return false;
    seen.add(link.label);
    return true;
  });
}

function extractBrandLogos(pageProps: any): NextDataBrandLogo[] {
  const brandItems = pageProps?.categoryData?.homeBrands?.items;
  if (!Array.isArray(brandItems)) return [];

  const logos: NextDataBrandLogo[] = [];

  for (const block of brandItems) {
    const html = block.content || '';
    const $ = cheerio.load(html);

    $('a[data-gtm-tracking="brand logo"], .brand-logo').each((_, el) => {
      const isImg = $(el).is('img');
      const anchor = isImg ? $(el).parent('a') : $(el);
      const img = isImg ? $(el) : $(el).find('img').first();

      const name = (anchor.attr('title') || img.attr('alt') || '').replace('View information for ', '');
      const logoUrl = img.attr('src') || '';
      const linkUrl = anchor.attr('href') || '';

      if (name && logoUrl) {
        logos.push({ name, logoUrl, linkUrl });
      }
    });
  }

  const seen = new Set<string>();
  return logos.filter((logo) => {
    if (seen.has(logo.name)) return false;
    seen.add(logo.name);
    return true;
  });
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return cheerio.load(html).text().trim().slice(0, 300);
}
