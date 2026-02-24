# SE Playbook: Building Custom Demos with ETL Tools

This guide walks you through building a custom Contentful demo using a prospect's actual website content. Designed for the MEDDPICC sales cycle — use this after the reverse demo to create a personalized, high-impact demo.

## When to Use This Tool

- After a **reverse demo** where the prospect has shown you their current stack
- When you have **3-10 key URLs** from the prospect's site that represent their content
- When you want to demo Contentful with **their actual content and branding**
- Target time: **1-5 hours** from start to demo-ready

## Prerequisites

- Node.js 18+ installed
- Contentful Management API token (get from Contentful web app > Settings > API Keys)
- A Contentful space to load content into (or use `create-demo` to make one)
- The prospect's website URLs

## Step-by-Step Workflow

### 1. Pre-Call Prep (15 minutes)

Browse the prospect's website and identify:

- **Homepage** — always include this (extracts branding)
- **2-3 product/feature pages** — the pages they care most about
- **1-2 supporting pages** — about, resources, etc.

Create your harvest config:

```bash
cp docs/examples/generic-saas.config.json harvest.config.json
```

Edit `harvest.config.json`:

```json
{
  "name": "Acme Corp Demo",
  "urls": [
    { "url": "https://www.acme.com", "type": "homepage" },
    { "url": "https://www.acme.com/products/platform", "type": "product" },
    { "url": "https://www.acme.com/products/analytics", "type": "product" },
    { "url": "https://www.acme.com/about", "type": "page" }
  ],
  "options": {
    "adapter": "cheerio",
    "downloadAssets": true,
    "extractBranding": true
  }
}
```

**Tips:**
- Start with 3-5 URLs. You can always add more later.
- Mark the homepage as `"type": "homepage"` — this triggers branding extraction.
- Product pages get the best results (clear structure, images, sections).

### 2. Harvest (15 minutes)

```bash
npm run cli -- harvest -c harvest.config.json
```

This creates `output/harvest/` with:
- `pages/*.json` — structured data for each URL
- `branding.json` — extracted colors, fonts, logo
- `manifest.json` — full harvest output

**Review the output:**
- Open `output/harvest/branding.json` — check the extracted colors and fonts look right
- Spot-check a page JSON — make sure the title, description, and sections were captured
- If a page failed (JS-rendered), note it for manual content creation in Contentful

### 3. Load into Contentful (20 minutes)

```bash
npm run cli -- load -s YOUR_SPACE_ID --seo --geo
```

This creates in Contentful:
- Brand Settings entry with prospect's colors/fonts
- Hero Section for each page
- Section entries with items
- SEO entries (AI-generated)
- GEO entries (AI-generated)
- Page entries linking everything together

**Verify in Contentful:**
1. Open the space in Contentful web app
2. Check that pages appear in the Content tab
3. Verify images uploaded correctly
4. Check the Brand Settings entry has reasonable colors

### 4. Customize in Contentful (30-120 minutes)

This is where you make it demo-ready. In the Contentful web app:

**Quick wins:**
- Fix any page titles that didn't extract cleanly
- Reorder sections if needed
- Add a tagline or CTA to hero sections

**Design tokens:**
- Adjust Brand Settings colors if the extraction was off
- Set the right font families

**Content polish:**
- Add missing sections manually (use the Section + Section Item content types)
- Create Duplex or Triplex entries for two/three-column layouts
- Add a Carousel for featured products

**Navigation:**
- Create Navigation Item entries for the header/footer
- Link them in Site Settings

### 5. AI Enrich (10 minutes)

If you didn't use `--seo --geo` during load, or want to enrich more pages:

```bash
npm run cli -- enrich -s YOUR_SPACE_ID --seo --geo
```

This finds pages missing SEO/GEO entries and generates them using AI Actions.

### 6. Demo Day

**Key talking points per screen:**

| Screen | What to show | Pain point it addresses |
|--------|-------------|----------------------|
| Content list | "Here's your actual content, structured and organized" | Content scattered across systems |
| Entry editor | Edit a headline live, show it update in preview | Slow content updates |
| Brand Settings | "Change one color, it updates everywhere" | Brand inconsistency |
| SEO entry | "AI generated this from your content" | Manual SEO work |
| GEO entry | "This makes your content discoverable by AI assistants" | Missing AI/LLM optimization |
| Sections | Reorder sections by dragging | Rigid page layouts |

**Live editing demo flow:**
1. Open a Page entry in Contentful
2. Edit the hero headline
3. Show the change in the preview (if preview app is running)
4. Open Brand Settings, change the primary color
5. Show how it cascades across all pages
6. Open an SEO entry, show the AI-generated metadata
7. Trigger a new AI Action to regenerate

### 7. Post-Demo (Optional)

If the prospect wants to explore:
- Share read-only access to the Contentful space
- The space itself serves as an implementation reference
- Content model, design tokens, and AI Actions are all transferable

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Page returns empty content | Site is JS-rendered. Add content manually or try Firecrawl adapter (future). |
| Images don't upload | Check the image URL is publicly accessible. Some CDNs block non-browser requests. |
| AI Actions fail | Make sure AI Actions are created in the space. Run `create-demo` or create manually. |
| Rate limit errors | Wait 1-2 minutes and retry. The loader handles basic rate limits. |
| Wrong colors extracted | Edit Brand Settings directly in Contentful. The extraction is a best guess. |

## Example Configs

| Industry | Config file | URLs |
|----------|------------|------|
| IoT/Industrial | `docs/examples/sierra-wireless.config.json` | Homepage + 4 product pages |
| Generic SaaS | `docs/examples/generic-saas.config.json` | Homepage + features + pricing + about |
