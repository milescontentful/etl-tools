import { PlainClientAPI } from 'contentful-management';
import { log } from '@etl-tools/shared';

interface UploadResult {
  localId: string;
  assetId: string;
  title: string;
}

export async function uploadAsset(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  opts: {
    title: string;
    description?: string;
    fileName: string;
    contentType: string;
    uploadUrl: string;
  }
): Promise<string> {
  const existing = await client.asset.getMany({
    spaceId,
    environmentId,
    query: { 'fields.title': opts.title, limit: 1 },
  });

  if (existing.items.length > 0) {
    const existingAsset = existing.items[0];
    const hasFile = existingAsset.fields?.file?.['en-US']?.url;
    if (hasFile) {
      log.dim(`Asset exists: "${opts.title}" (${existingAsset.sys.id})`);
      return existingAsset.sys.id;
    }
  }

  const asset = await client.asset.create(
    { spaceId, environmentId },
    {
      fields: {
        title: { 'en-US': opts.title },
        description: { 'en-US': opts.description || '' },
        file: {
          'en-US': {
            contentType: opts.contentType,
            fileName: opts.fileName,
            upload: opts.uploadUrl,
          },
        },
      },
    }
  );

  await client.asset.processForAllLocales(
    { spaceId, environmentId, assetId: asset.sys.id },
    asset
  );

  let processed = false;
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    const check = await client.asset.get({ spaceId, environmentId, assetId: asset.sys.id });
    if (check.fields?.file?.['en-US']?.url) {
      try {
        await client.asset.publish({ spaceId, environmentId, assetId: asset.sys.id }, check);
      } catch {
        // may already be published
      }
      processed = true;
      break;
    }
  }

  if (!processed) {
    log.warn(`Asset "${opts.title}" uploaded but may still be processing`);
  }

  return asset.sys.id;
}

export async function uploadAssetsFromManifest(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  assets: Array<{ title: string; fileName: string; contentType: string; uploadUrl: string }>
): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {};
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  log.heading(`Uploading ${assets.length} assets`);

  for (const asset of assets) {
    try {
      const assetId = await uploadAsset(client, spaceId, environmentId, asset);
      idMap[asset.fileName] = assetId;
      uploaded++;
      log.success(`"${asset.title}" (${assetId})`);
    } catch (err) {
      failed++;
      log.error(`"${asset.title}": ${(err as Error).message}`);
    }
  }

  log.info(`Assets: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  return idMap;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
