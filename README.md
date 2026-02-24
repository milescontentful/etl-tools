# Contentful ETL Tools

**Harvest prospect websites, load into Contentful, preview with their branding — in 1-5 hours.**

A toolkit for Contentful Solution Engineers to build custom demos using a prospect's actual website content. After a reverse demo, use these tools to scrape the prospect's site, load the content and images into Contentful, generate SEO/GEO metadata with AI Actions, and spin up a branded preview app.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/milescontentful/etl-tools.git
cd etl-tools
npm install

# 2. Configure credentials
cp .env.template .env.local
# Edit .env.local with your Contentful Management Token and Space ID

# 3. Create your harvest config (or copy an example)
cp docs/examples/sierra-wireless.config.json harvest.config.json
# Edit harvest.config.json with your prospect's URLs

# 4. Run the full pipeline
npm run cli -- run --config harvest.config.json --space YOUR_SPACE_ID --seo --geo
```

## How It Works

```
                                    ETL Pipeline
  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
  │   HARVEST    │     │     LOAD     │     │    ENRICH     │     │   PREVIEW    │
  │              │     │              │     │               │     │              │
  │ Scrape URLs  │────>│ Upload assets│────>│ AI SEO/GEO    │────>│ Branded app  │
  │ Extract data │     │ Create pages │     │ Quality score │     │ Live Preview │
  │ Get branding │     │ Link refs    │     │ Translation   │     │ Inspector    │
  └─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘

  ~15 min               ~20 min               ~10 min               ~30 min
```

## Time Budget

| Step | Time | What you do |
|------|------|-------------|
| Configure | 5-10 min | Create `harvest.config.json` with prospect URLs |
| Harvest | 5-15 min | Run harvester, review output |
| Load | 10-20 min | Run loader, verify in Contentful |
| Customize | 30-120 min | Adjust content, design tokens, add sections in Contentful |
| AI Enrich | 5-10 min | Generate SEO/GEO metadata via AI Actions |
| Preview | 10-30 min | Start preview app, configure branding |
| Polish | 30-60 min | Fine-tune for demo narrative |
| **Total** | **1-5 hours** | Realistic custom demo with prospect's actual content |

## CLI Commands

```bash
# Full pipeline
npm run cli -- run -c harvest.config.json -s SPACE_ID [--seo] [--geo]

# Individual steps
npm run cli -- harvest -c harvest.config.json           # Scrape URLs
npm run cli -- load -s SPACE_ID [--seo] [--geo]         # Load into Contentful
npm run cli -- enrich -s SPACE_ID [--seo] [--geo]       # AI-enrich existing content
```

## harvest.config.json

```json
{
  "name": "Acme Corp Demo",
  "urls": [
    { "url": "https://www.acme.com", "type": "homepage" },
    { "url": "https://www.acme.com/products/widget", "type": "product" },
    { "url": "https://www.acme.com/about", "type": "page" }
  ],
  "options": {
    "adapter": "cheerio",
    "downloadAssets": true,
    "extractBranding": true
  }
}
```

See `docs/examples/` for more templates (IoT, SaaS, e-commerce).

## What Gets Extracted

From each URL:
- **Page content**: title, H1, description, body text, meta tags, Open Graph
- **Hero section**: headline, subtitle, CTA text/link, hero image
- **Page sections**: detected heading + list structures
- **Images**: all images with dedup and tracking pixel filtering
- **Branding** (homepage): logo, favicon, colors, fonts, border-radius
- **Taxonomy hints**: breadcrumbs, schema.org data, categories
- **SEO data**: meta title, description, keywords, Open Graph

## What Gets Created in Contentful

For each page:
1. **Hero Section** entry with headline, subtitle, image, CTA
2. **Section** entries with **Section Items** (if detected)
3. **SEO** entry (optional, AI-generated via Contentful AI Actions)
4. **GEO** entry (optional, AI-generated for LLM discoverability)
5. **Page** entry linking hero, sections, SEO, and GEO

Plus a **Brand Settings** entry from homepage branding (colors, fonts, logo).

## Content Model

The toolkit uses a 13-type content model (in `templates/content-model.json`):

| Content Type | Purpose |
|-------------|---------|
| `page` | Main page container with sections |
| `heroSection` | Hero banner with headline, CTA, image |
| `section` | Content section with items |
| `sectionItem` | Individual item within a section |
| `seo` | SEO metadata (AI-generatable) |
| `geo` | AI Discovery / GEO content (AI-generatable) |
| `brandSettings` | Design tokens: colors, fonts, border-radius |
| `siteSettings` | Global site configuration |
| `navigationItem` | Navigation links |
| `duplex` | Two-column layout |
| `triplex` | Three-column layout |
| `carousel` | Horizontal scrolling content |
| `cardGrid` | Grid of cards |

## AI Actions

Three AI Actions are available (created via `templates/ai-actions.json`):

| Action | Model | What it generates |
|--------|-------|------------------|
| Generate SEO Metadata | Claude 4.5 Sonnet | Meta title, description, keywords, OG tags |
| Generate AI Discovery | Claude 4.5 Sonnet | AI summary, use cases, FAQs, differentiators |
| Translate | Claude 4.5 Sonnet | Translated content for any locale |

## Project Structure

```
etl-tools/
  packages/
    shared/           # Types, config, Contentful client, CLI, logger
    harvest/          # Web scraping: adapters + extractors
    loader/           # Contentful loading: assets, entries, AI enrichment
  templates/          # Content model + AI Action definitions
  docs/               # SE Playbook, guides, example configs
  output/             # Generated harvest data (gitignored)
```

## Requirements

- Node.js 18+
- Contentful Management API token
- A Contentful space with the content model imported

## Documentation

- [SE Playbook](docs/SE-PLAYBOOK.md) — Step-by-step demo workflow for sales cycles
- [Harvest Guide](docs/HARVEST-GUIDE.md) — URL configuration and adapter options
- [Content Model](docs/CONTENT-MODEL.md) — Content type reference
- [Example Configs](docs/examples/) — Ready-to-use harvest configs

## Future Roadmap

- **Firecrawl adapter** — AI-powered scraping for JS-rendered sites
- **Crawlee adapter** — Multi-page crawling with Playwright
- **Preview app** — Branded preview templated from xbone2
- **Contentful App** — In-app URL importer and quality dashboard
- **Personalization** — Taxonomy-driven audience segments and content variations
- **Implementation blueprint** — Export as starter kit for prospect implementation
