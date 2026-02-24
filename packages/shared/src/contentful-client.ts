import { createClient, PlainClientAPI } from 'contentful-management';
import { AppConfig } from './config';

let clientInstance: PlainClientAPI | null = null;

export function getContentfulClient(config: AppConfig): PlainClientAPI {
  if (clientInstance) return clientInstance;

  if (!config.contentful.managementToken) {
    throw new Error(
      'CONTENTFUL_MANAGEMENT_TOKEN is required. Set it in .env.local or pass via --token flag.'
    );
  }

  clientInstance = createClient(
    { accessToken: config.contentful.managementToken },
    { type: 'plain' }
  );

  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}
