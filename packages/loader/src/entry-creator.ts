import { PlainClientAPI } from 'contentful-management';
import { EntryPayload, LoadReport, log } from '@etl-tools/shared';

function makeLink(id: string, linkType: 'Entry' | 'Asset' = 'Entry') {
  return { sys: { type: 'Link' as const, linkType, id } };
}

function localize<T>(value: T): { 'en-US': T } {
  return { 'en-US': value };
}

export async function createEntry(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
  fields: Record<string, unknown>,
  metadata?: EntryPayload['metadata']
): Promise<string> {
  const createPayload: Record<string, unknown> = { fields };
  if (metadata) {
    createPayload.metadata = metadata;
  }

  const entry = await client.entry.create(
    { spaceId, environmentId, contentTypeId },
    createPayload as any
  );

  return entry.sys.id;
}

export async function publishEntry(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  entryId: string
): Promise<void> {
  const entry = await client.entry.get({ spaceId, environmentId, entryId });
  await client.entry.publish({ spaceId, environmentId, entryId }, entry);
}

export async function createAndPublishEntry(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
  fields: Record<string, unknown>,
  metadata?: EntryPayload['metadata']
): Promise<string> {
  const entryId = await createEntry(client, spaceId, environmentId, contentTypeId, fields, metadata);
  try {
    await publishEntry(client, spaceId, environmentId, entryId);
  } catch {
    log.warn(`Entry ${entryId} created but could not publish`);
  }
  return entryId;
}

/**
 * Resolve local reference IDs to real Contentful IDs using an ID map.
 * Walks all field values looking for { _localRef: "localId" } markers
 * and replaces them with proper Contentful Link objects.
 */
export function resolveReferences(
  fields: Record<string, Record<string, unknown>>,
  idMap: Record<string, string>
): Record<string, Record<string, unknown>> {
  const resolved = JSON.parse(JSON.stringify(fields));

  for (const [fieldId, localeValues] of Object.entries(resolved)) {
    for (const [locale, value] of Object.entries(localeValues as Record<string, unknown>)) {
      if (value && typeof value === 'object' && '_localRef' in (value as any)) {
        const localId = (value as any)._localRef;
        const linkType = (value as any)._linkType || 'Entry';
        const realId = idMap[localId];
        if (realId) {
          (resolved[fieldId] as any)[locale] = makeLink(realId, linkType);
        }
      }

      if (Array.isArray(value)) {
        (resolved[fieldId] as any)[locale] = value.map((item: any) => {
          if (item && typeof item === 'object' && '_localRef' in item) {
            const realId = idMap[item._localRef];
            const linkType = item._linkType || 'Entry';
            return realId ? makeLink(realId, linkType) : item;
          }
          return item;
        });
      }
    }
  }

  return resolved;
}

/**
 * Topological sort of entry payloads by their dependency graph.
 * Entries with no dependencies come first.
 */
export function sortByDependencies(entries: EntryPayload[]): EntryPayload[] {
  const byId = new Map(entries.map((e) => [e.localId, e]));
  const visited = new Set<string>();
  const sorted: EntryPayload[] = [];

  function visit(entry: EntryPayload) {
    if (visited.has(entry.localId)) return;
    visited.add(entry.localId);
    for (const depId of entry.dependsOn || []) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    sorted.push(entry);
  }

  for (const entry of entries) {
    visit(entry);
  }

  return sorted;
}

export { makeLink, localize };
