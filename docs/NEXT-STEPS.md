# Next Steps: ETL Tools Roadmap

This document captures the current state and prioritized next steps for the demo engineering team.

## Current State (Feb 23, 2026)

**What works:**
- Playwright adapter for JS-rendered sites (stealth mode, auto-scroll)
- Cheerio adapter for static HTML
- Branding extraction (logo, colors, fonts, favicon, border-radius)
- Image extraction and categorization (66 images from Harvey Norman)
- Asset upload to Contentful (create, process, poll, publish)
- Entry creation in dependency order (Brand Settings -> Hero -> Sections -> Pages)
- Content model template (13 content types)
- AI Action templates (SEO, GEO, Translation)
- Prospect profiles for saving demo setups
- SE Playbook documentation

**What's lightweight:**
- Section extraction only detects heading + list patterns (misses custom components)
- Product extraction doesn't parse JS-rendered product cards
- Navigation extraction doesn't handle hamburger menus
- Only 3 entries created for Harvey Norman (should be 80-100)

## Priority 1: `__NEXT_DATA__` Extractor (Highest ROI)

Harvey Norman (and many e-commerce sites) is a Next.js app. The entire product catalog is embedded as structured JSON in a `<script id="__NEXT_DATA__">` tag in the page source.

### What the JSON contains

From the Harvey Norman `__NEXT_DATA__` payload:

**Products (24 items):**
```json
{
  "name": "Google Pixel 10a",
  "sku": "11901360872",
  "url_key": "google-pixel-10a",
  "price_range": { "minimum_price": { "final_price": { "value": 849 } } },
  "ratings": { "average": 4.2, "count": 13 },
  "small_image": { "url": "https://hnau.imgix.net/..." },
  "offers": { "bonus": { "type": "Pre-Order", "title": "..." } },
  "short_description": { "html": "..." }
}
```

**Navigation (full tree, hundreds of items):**
```json
{
  "atlasNav": {
    "content": "[{\"id\":\"4\",\"title\":\"Computers & Tablets\",\"children\":[...]}]"
  }
}
```

**CMS Blocks (hero slider, footer, branding):**
- Hero slider with 2 rotating banners (desktop + mobile images)
- Footer with 50+ links in 4 columns
- Trusted brands section with 12 brand logos

### Implementation

1. After Playwright captures the page, extract the `__NEXT_DATA__` script tag
2. Parse the JSON payload
3. Map to Contentful entries:
   - Each product -> `sectionItem` entry (name, price, image, URL)
   - Product grid -> `cardGrid` or `section` entry
   - Navigation tree -> `navigationItem` entries (hierarchical)
   - Hero slider -> `heroSection` entries + `carousel`
   - Footer links -> `navigationItem` entries
   - Brand logos -> `section` with logo assets

### Expected output: 80-100+ entries

| Content | Entries | Content Type |
|---------|---------|-------------|
| Products | ~24 | sectionItem |
| Product sections | ~6 | section / cardGrid |
| Navigation items | ~50 | navigationItem |
| Hero banners | 2-3 | heroSection |
| Footer links | ~20 | navigationItem |
| Brand Settings | 1 | brandSettings |
| Page | 1 | page |
| **Total** | **~100+** | |

### This approach works for many frameworks

| Framework | Data Location | Sites |
|-----------|--------------|-------|
| Next.js | `__NEXT_DATA__` script tag | Harvey Norman, many e-commerce |
| Nuxt.js | `__NUXT__` or `__NUXT_DATA__` | Vue-based sites |
| Gatsby | `___gatsby` or inline JSON | Marketing sites |
| SvelteKit | `__sveltekit_` data | Modern web apps |

## Priority 2: Chrome Extension for Visual Mapping

For sites that don't embed structured data, build a Chrome extension that lets SEs visually map page sections to content types.

### Features
- Click a div and tag it as a content type (heroSection, cardGrid, section, etc.)
- Highlight product cards and map fields (name -> title, price -> price, etc.)
- Export mapping as a JSON config file
- Save mappings per-site for reuse by other SEs
- Import saved mappings to auto-extract on revisit

### Technical approach
- Chrome Manifest V3 extension
- Content script injects overlay UI
- Background script manages saved mappings
- Export format compatible with harvest.config.json

### Effort: ~1 week for MVP

## Priority 3: Firecrawl Integration

Firecrawl (https://firecrawl.dev) provides AI-powered web scraping that converts pages to clean markdown + structured data. It handles JS rendering, anti-bot, and outputs structured content.

### When to use
- Sites without `__NEXT_DATA__` or similar
- Sites with complex JS rendering
- When you need clean markdown content (for rich text fields)

### Integration
- Add `firecrawl` adapter alongside `cheerio` and `playwright`
- Configure via `"adapter": "firecrawl"` in harvest.config.json
- Requires API key ($20/month)

## Priority 4: Enhanced Product Card Extractor

For sites that render product cards in the DOM (not via `__NEXT_DATA__`), build CSS-selector-based extractors for common e-commerce patterns:

### Harvey Norman selectors (discovered from HTML analysis)
```
Product card: .GelBrickProductCard_sf-product-card___iJCN
Product name: .GelBrickProductCardName_sf-product-card__name__link__4jGRa
Product price: .GelBrickProductCardPriceList_sf-product-card-price-list__amount__DiAK2
Product image: .GelBrickProductCardImage_sf-product-card__image__xBr7j img
Offer flag: .GelBrickProductOfferFlag_sf-product__flag__b0pdc span
Rating stars: .GelBrickRating_sf-rating-container__star-fill__q_zUA
Footer links: footer a
```

These selectors could be saved as a "site profile" and reused.

## Handoff Notes for Demo Engineering Team

### Repository
- GitHub: https://github.com/milescontentful/etl-tools
- Stack: TypeScript, Node.js, Playwright, Cheerio, Contentful Management SDK

### Key files
- `packages/harvest/src/adapters/playwright.ts` - Playwright scraper with stealth mode
- `packages/harvest/src/extractors/` - Branding, taxonomy, section, asset extractors
- `packages/loader/src/page-loader.ts` - Full load pipeline (assets + entries + AI)
- `packages/loader/src/ai-enrichment.ts` - AI Action integration (SEO/GEO/Translation)
- `templates/content-model.json` - 13 content types
- `templates/ai-actions.json` - 3 AI Action definitions
- `profiles/harvey-norman.json` - First prospect profile with section mapping

### What the demo engineering team should build
1. `__NEXT_DATA__` extractor (Priority 1) - parse embedded JSON from Next.js sites
2. Enhanced page loader that creates navigation, product grids, footer entries
3. Chrome extension for visual section mapping (Priority 2)
4. Firecrawl adapter integration (Priority 3)
5. Preview app template from xbone2 project

### Content model note
The content model uses "Product" as a lightweight product catalog type (was "Game" in the xbone2 project). For e-commerce demos, products should be created as `sectionItem` entries with product-specific fields, or a dedicated `product` content type could be added to the template.

### Contentful MCP tools available
The workspace has 64 Contentful MCP tools for direct API access:
- `list_content_types` / `get_content_type` - content model introspection
- `create_entry` / `update_entry` / `publish_entry` - entry management
- `upload_asset` - asset uploads
- `create_ai_action` / `invoke_ai_action` - AI enrichment
- `search_entries` - idempotent checks
