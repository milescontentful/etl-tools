// =============================================
// Harvest types — output of the scraping stage
// =============================================

export interface HarvestConfig {
  name: string;
  urls: HarvestUrl[];
  options?: HarvestOptions;
}

export interface HarvestUrl {
  url: string;
  type?: 'homepage' | 'product' | 'page' | 'category' | 'blog';
  hints?: Record<string, string>;
}

export interface HarvestOptions {
  adapter?: 'cheerio' | 'firecrawl' | 'crawlee';
  downloadAssets?: boolean;
  extractBranding?: boolean;
  maxDepth?: number;
  outputDir?: string;
}

export interface ScrapedBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  neutralLight?: string;
  neutralDark?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
  borderRadius?: 'none' | 'small' | 'medium' | 'large';
  heroImageUrl?: string;
  productImages: string[];
}

export interface TaxonomyHints {
  breadcrumbs: string[];
  urlPath: string[];
  metaCategories: string[];
  suggestedConcepts: string[];
}

export interface ScrapedSection {
  title: string;
  items: { name: string; link: string; description?: string }[];
}

export interface ScrapedPage {
  url: string;
  slug: string;
  title: string;
  h1: string;
  description: string;
  bodyText: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  images: string[];
  heroSubtitle?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  sections?: ScrapedSection[];
  branding?: ScrapedBranding;
  taxonomyHints?: TaxonomyHints;
}

export interface HarvestOutput {
  config: HarvestConfig;
  pages: ScrapedPage[];
  branding: ScrapedBranding | null;
  assets: AssetManifestEntry[];
  timestamp: string;
}

export interface AssetManifestEntry {
  originalUrl: string;
  localPath: string;
  fileName: string;
  contentType: string;
  category: 'logo' | 'favicon' | 'hero' | 'product' | 'section' | 'icon' | 'other';
}

// =============================================
// Loader types — input to Contentful loading
// =============================================

export interface LoaderConfig {
  spaceId: string;
  environmentId: string;
  managementToken: string;
  dryRun?: boolean;
  publishAfterCreate?: boolean;
}

export interface EntryPayload {
  localId: string;
  contentTypeId: string;
  fields: Record<string, Record<string, unknown>>;
  metadata?: {
    tags?: Array<{ sys: { type: 'Link'; linkType: 'Tag'; id: string } }>;
    concepts?: Array<{ sys: { type: 'Link'; linkType: 'TaxonomyConcept'; id: string } }>;
  };
  dependsOn?: string[];
}

export interface AssetPayload {
  localId: string;
  title: string;
  description?: string;
  fileName: string;
  contentType: string;
  uploadUrl: string;
}

export interface LoadReport {
  spaceId: string;
  environmentId: string;
  assetsCreated: number;
  entriesCreated: number;
  errors: string[];
  idMap: Record<string, string>;
  timestamp: string;
}

// =============================================
// AI Enrichment types
// =============================================

export interface SeoFields {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
}

export interface GeoFields {
  aiSummary: string;
  aiBestFor: string[];
  aiIntents: string[];
  aiKeyPoints: string[];
  aiDifferentiators: string[];
  aiCompetitors: string[];
  aiFaq: Array<{ question: string; answer: string }>;
}

// =============================================
// Gap analysis types
// =============================================

export interface GapReportItem {
  status: 'ok' | 'missing' | 'warn';
  category: 'content-type' | 'field' | 'design-token' | 'asset';
  name: string;
  detail: string;
}

export interface GapReport {
  spaceName: string;
  spaceId: string;
  items: GapReportItem[];
  assetSummary: {
    imageCount: number;
    videoCount: number;
    estimatedSizeMB: number;
  };
}
