#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, loadHarvestConfig } from './config';
import { getContentfulClient } from './contentful-client';
import * as log from './logger';
import type { HarvestConfig, HarvestOutput } from './types';

const program = new Command();

program
  .name('etl')
  .description('Contentful ETL toolkit for Solution Engineers')
  .version('0.1.0');

// ─── harvest ──────────────────────────────────────────────
program
  .command('harvest')
  .description('Scrape web pages and extract content, branding, and assets')
  .requiredOption('-c, --config <path>', 'Path to harvest.config.json')
  .option('-o, --output <dir>', 'Output directory', 'output')
  .action(async (opts) => {
    const { harvest } = await import('@etl-tools/harvest');
    const harvestConfig: HarvestConfig = loadHarvestConfig(opts.config);
    const outputDir = path.resolve(process.cwd(), opts.output);
    await harvest(harvestConfig, outputDir);
  });

// ─── load ─────────────────────────────────────────────────
program
  .command('load')
  .description('Load harvested content into a Contentful space')
  .option('-s, --space <id>', 'Contentful space ID')
  .option('-e, --env <id>', 'Contentful environment', 'master')
  .option('-i, --input <dir>', 'Harvest output directory', 'output')
  .option('--seo', 'Generate SEO metadata via AI Actions')
  .option('--geo', 'Generate GEO content via AI Actions')
  .action(async (opts) => {
    const { loadHarvestOutput } = await import('@etl-tools/loader');
    const config = loadConfig({ contentful: { spaceId: opts.space, environmentId: opts.env, managementToken: '' } });
    const client = getContentfulClient(config);

    const manifestPath = path.resolve(process.cwd(), opts.input, 'harvest', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      log.error(`No harvest manifest found at ${manifestPath}. Run 'etl harvest' first.`);
      process.exit(1);
    }

    const harvestOutput: HarvestOutput = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    await loadHarvestOutput(client, harvestOutput, {
      spaceId: config.contentful.spaceId,
      environmentId: config.contentful.environmentId,
      enableSeo: opts.seo,
      enableGeo: opts.geo,
    });
  });

// ─── enrich ───────────────────────────────────────────────
program
  .command('enrich')
  .description('Enrich existing content with AI-generated SEO/GEO metadata')
  .option('-s, --space <id>', 'Contentful space ID')
  .option('-e, --env <id>', 'Contentful environment', 'master')
  .option('--seo', 'Generate SEO metadata')
  .option('--geo', 'Generate GEO content')
  .action(async (opts) => {
    const config = loadConfig({ contentful: { spaceId: opts.space, environmentId: opts.env, managementToken: '' } });
    const client = getContentfulClient(config);
    const { findAiActions, generateSeo, generateGeo, createSeoEntry, createGeoEntry } = await import('@etl-tools/loader');

    const { spaceId, environmentId } = config.contentful;
    const aiActions = await findAiActions(client, spaceId, environmentId);

    const pages = await client.entry.getMany({
      spaceId,
      environmentId,
      query: { content_type: 'page', limit: 100 },
    });

    log.heading(`Enriching ${pages.items.length} pages`);

    for (const page of pages.items) {
      const title = (page.fields as any).title?.['en-US'] || 'Untitled';
      const hasSeo = !!(page.fields as any).seo?.['en-US'];
      const hasGeo = !!(page.fields as any).geo?.['en-US'];

      if (opts.seo && !hasSeo && aiActions.seoActionId) {
        const spin = log.spinner(`SEO: ${title}`);
        try {
          const description = (page.fields as any).sourceUrl?.['en-US'] || title;
          const seo = await generateSeo(client, spaceId, environmentId, aiActions.seoActionId, title, description);
          const seoId = await createSeoEntry(client, spaceId, environmentId, seo);

          const updated = await client.entry.get({ spaceId, environmentId, entryId: page.sys.id });
          (updated.fields as any).seo = { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: seoId } } };
          await client.entry.update({ spaceId, environmentId, entryId: page.sys.id }, updated);
          const refreshed = await client.entry.get({ spaceId, environmentId, entryId: page.sys.id });
          await client.entry.publish({ spaceId, environmentId, entryId: page.sys.id }, refreshed);

          spin.succeed(`SEO: ${title} (${seoId})`);
        } catch (err) {
          spin.fail(`SEO: ${title} — ${(err as Error).message}`);
        }
      }

      if (opts.geo && !hasGeo && aiActions.geoActionId) {
        const spin = log.spinner(`GEO: ${title}`);
        try {
          const description = (page.fields as any).sourceUrl?.['en-US'] || title;
          const geo = await generateGeo(client, spaceId, environmentId, aiActions.geoActionId, title, description, 'General');
          const geoId = await createGeoEntry(client, spaceId, environmentId, geo);

          const updated = await client.entry.get({ spaceId, environmentId, entryId: page.sys.id });
          (updated.fields as any).geo = { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: geoId } } };
          await client.entry.update({ spaceId, environmentId, entryId: page.sys.id }, updated);
          const refreshed = await client.entry.get({ spaceId, environmentId, entryId: page.sys.id });
          await client.entry.publish({ spaceId, environmentId, entryId: page.sys.id }, refreshed);

          spin.succeed(`GEO: ${title} (${geoId})`);
        } catch (err) {
          spin.fail(`GEO: ${title} — ${(err as Error).message}`);
        }
      }
    }
  });

// ─── run (full pipeline) ─────────────────────────────────
program
  .command('run')
  .description('Run the full pipeline: harvest -> load -> enrich')
  .requiredOption('-c, --config <path>', 'Path to harvest.config.json')
  .option('-s, --space <id>', 'Contentful space ID')
  .option('-e, --env <id>', 'Contentful environment', 'master')
  .option('-o, --output <dir>', 'Output directory', 'output')
  .option('--seo', 'Generate SEO metadata via AI Actions')
  .option('--geo', 'Generate GEO content via AI Actions')
  .action(async (opts) => {
    const { harvest } = await import('@etl-tools/harvest');
    const { loadHarvestOutput } = await import('@etl-tools/loader');

    log.heading('ETL Pipeline — Full Run');

    const harvestConfig: HarvestConfig = loadHarvestConfig(opts.config);
    const outputDir = path.resolve(process.cwd(), opts.output);

    log.heading('Step 1/2: Harvest');
    const harvestOutput = await harvest(harvestConfig, outputDir);

    log.heading('Step 2/2: Load into Contentful');
    const config = loadConfig({ contentful: { spaceId: opts.space, environmentId: opts.env, managementToken: '' } });
    const client = getContentfulClient(config);

    await loadHarvestOutput(client, harvestOutput, {
      spaceId: config.contentful.spaceId,
      environmentId: config.contentful.environmentId,
      enableSeo: opts.seo,
      enableGeo: opts.geo,
    });

    log.heading('Pipeline complete');
  });

program.parse();
