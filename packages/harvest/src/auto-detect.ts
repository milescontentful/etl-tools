import * as cheerio from 'cheerio';

export type SiteStrategy =
  | 'nextjs'
  | 'nuxtjs'
  | 'gatsby'
  | 'react-static'
  | 'static'
  | 'blocked';

export interface DetectionResult {
  strategy: SiteStrategy;
  framework?: string;
  frameworkVersion?: string;
  hasStructuredData: boolean;
  hasProducts: boolean;
  hasNavigation: boolean;
  pageSize: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

export function detectStrategy(html: string, url: string): DetectionResult {
  const $ = cheerio.load(html);
  const size = html.length;

  // Check for Next.js
  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    let hasProducts = false;
    let hasNav = false;
    let version: string | undefined;
    try {
      const parsed = JSON.parse(nextData);
      version = parsed?.buildId ? 'detected' : undefined;
      const pp = parsed?.props?.pageProps?.pageProps || parsed?.props?.pageProps;
      hasProducts = Array.isArray(pp?.catalogData?.homeProducts?.items);
      hasNav = !!pp?.pageData?.atlasNav?.content;
    } catch {}

    return {
      strategy: 'nextjs',
      framework: 'Next.js',
      frameworkVersion: version,
      hasStructuredData: true,
      hasProducts,
      hasNavigation: hasNav,
      pageSize: size,
      confidence: 'high',
      recommendation: 'Use __NEXT_DATA__ structured JSON extraction',
    };
  }

  // Check for Nuxt.js
  if (html.includes('__NUXT__') || html.includes('__NUXT_DATA__') || html.includes('_nuxt')) {
    return {
      strategy: 'nuxtjs',
      framework: 'Nuxt.js',
      hasStructuredData: true,
      hasProducts: false,
      hasNavigation: false,
      pageSize: size,
      confidence: 'medium',
      recommendation: 'Parse __NUXT__ or __NUXT_DATA__ payload',
    };
  }

  // Check for Gatsby
  if (html.includes('___gatsby') || html.includes('gatsby-')) {
    return {
      strategy: 'gatsby',
      framework: 'Gatsby',
      hasStructuredData: false,
      hasProducts: false,
      hasNavigation: false,
      pageSize: size,
      confidence: 'medium',
      recommendation: 'Use static HTML extraction with Cheerio',
    };
  }

  // Bot-blocked detection (skeleton page)
  if (size < 5000 || (!$('h1').length && !$('main').length && !$('article').length)) {
    return {
      strategy: 'blocked',
      hasStructuredData: false,
      hasProducts: false,
      hasNavigation: false,
      pageSize: size,
      confidence: 'high',
      recommendation: 'Site blocked scraping. Try: 1) Save HTML from browser, 2) Wayback Machine, 3) Firecrawl',
    };
  }

  // React SPA without Next.js
  if (html.includes('data-reactroot') || html.includes('_reactRoot') || html.includes('__REACT_DEVTOOLS')) {
    return {
      strategy: 'react-static',
      framework: 'React',
      hasStructuredData: false,
      hasProducts: false,
      hasNavigation: false,
      pageSize: size,
      confidence: 'low',
      recommendation: 'JS-rendered React app. Use Playwright with DOM extraction or Firecrawl',
    };
  }

  // Static HTML (good for Cheerio)
  const hasGoodStructure = $('h1').length > 0 || $('h2').length > 2 || $('nav').length > 0;
  return {
    strategy: 'static',
    hasStructuredData: false,
    hasProducts: $('[class*="product"], [data-product]').length > 0,
    hasNavigation: $('nav').length > 0,
    pageSize: size,
    confidence: hasGoodStructure ? 'medium' : 'low',
    recommendation: 'Use Cheerio CSS selector extraction',
  };
}

export function formatDetectionReport(url: string, result: DetectionResult): string {
  const lines = [
    `  ${url}`,
    `    Framework: ${result.framework || 'Unknown'}`,
    `    Strategy: ${result.recommendation}`,
    `    Confidence: ${result.confidence}`,
    `    Page size: ${(result.pageSize / 1024).toFixed(0)} KB`,
  ];
  if (result.hasProducts) lines.push('    Products: detected');
  if (result.hasNavigation) lines.push('    Navigation: detected');
  if (result.hasStructuredData) lines.push('    Structured data: available');
  return lines.join('\n');
}
