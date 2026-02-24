import { PlainClientAPI } from 'contentful-management';
import { SeoFields, GeoFields, log } from '@etl-tools/shared';
import { parseSeoOutput, parseGeoOutput } from '@etl-tools/shared/dist/ai-actions';
import { createAndPublishEntry, makeLink, localize } from './entry-creator';

interface AiActionIds {
  seoActionId?: string;
  geoActionId?: string;
  translateActionId?: string;
}

export async function findAiActions(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string
): Promise<AiActionIds> {
  const ids: AiActionIds = {};

  try {
    const actions = await (client as any).aiAction.getMany({
      spaceId,
      environmentId,
      query: { limit: 10 },
    });

    for (const action of actions.items || []) {
      const name = action.name?.toLowerCase() || '';
      if (name.includes('seo')) ids.seoActionId = action.sys.id;
      if (name.includes('discovery') || name.includes('geo')) ids.geoActionId = action.sys.id;
      if (name.includes('translate')) ids.translateActionId = action.sys.id;
    }
  } catch {
    log.warn('Could not list AI Actions — they may need to be created first');
  }

  return ids;
}

export async function invokeAiAction(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  actionId: string,
  variables: Record<string, string>
): Promise<string> {
  const invocation = await (client as any).aiAction.invoke({
    spaceId,
    environmentId,
    aiActionId: actionId,
    variables: Object.entries(variables).map(([id, value]) => ({
      id,
      value,
    })),
  });

  const invocationId = invocation?.sys?.id;
  if (!invocationId) throw new Error('No invocation ID returned');

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await (client as any).aiAction.getInvocation({
      spaceId,
      environmentId,
      aiActionId: actionId,
      invocationId,
    });
    if (result?.status === 'completed' && result?.output) {
      return result.output;
    }
    if (result?.status === 'failed') {
      throw new Error(`AI Action failed: ${result.error || 'unknown error'}`);
    }
  }

  throw new Error('AI Action timed out after 60 seconds');
}

export async function generateSeo(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  actionId: string,
  title: string,
  description: string
): Promise<SeoFields> {
  const output = await invokeAiAction(client, spaceId, environmentId, actionId, {
    title,
    description,
  });
  return parseSeoOutput(output);
}

export async function generateGeo(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  actionId: string,
  productName: string,
  productDescription: string,
  productCategory: string
): Promise<GeoFields> {
  const output = await invokeAiAction(client, spaceId, environmentId, actionId, {
    productName,
    productDescription,
    productCategory,
  });
  return parseGeoOutput(output);
}

export async function createSeoEntry(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  seo: SeoFields
): Promise<string> {
  return createAndPublishEntry(client, spaceId, environmentId, 'seo', {
    metaTitle: localize(seo.metaTitle),
    metaDescription: localize(seo.metaDescription),
    keywords: localize(seo.keywords),
    ogTitle: localize(seo.ogTitle),
    ogDescription: localize(seo.ogDescription),
  });
}

export async function createGeoEntry(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  geo: GeoFields
): Promise<string> {
  return createAndPublishEntry(client, spaceId, environmentId, 'geo', {
    aiSummary: localize(geo.aiSummary),
    aiBestFor: localize(geo.aiBestFor),
    aiIntents: localize(geo.aiIntents),
    aiKeyPoints: localize(geo.aiKeyPoints),
    aiDifferentiators: localize(geo.aiDifferentiators),
    aiCompetitors: localize(geo.aiCompetitors),
    aiFaq: localize({ items: geo.aiFaq }),
    aiLastVerified: localize(new Date().toISOString()),
  });
}
