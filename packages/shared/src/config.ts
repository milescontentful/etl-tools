import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  contentful: {
    managementToken: string;
    spaceId: string;
    environmentId: string;
    organizationId?: string;
  };
  firecrawlApiKey?: string;
  outputDir: string;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const config: AppConfig = {
    contentful: {
      managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN || '',
      spaceId: overrides?.contentful?.spaceId || process.env.CONTENTFUL_SPACE_ID || '',
      environmentId: overrides?.contentful?.environmentId || process.env.CONTENTFUL_ENVIRONMENT || 'master',
      organizationId: process.env.CONTENTFUL_ORGANIZATION_ID,
    },
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
    outputDir: overrides?.outputDir || path.resolve(process.cwd(), 'output'),
  };

  if (overrides?.contentful?.managementToken) {
    config.contentful.managementToken = overrides.contentful.managementToken;
  }

  return config;
}

export function loadHarvestConfig(configPath: string) {
  const fullPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Harvest config not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

export function ensureOutputDir(outputDir: string, subdir: string): string {
  const dir = path.join(outputDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
