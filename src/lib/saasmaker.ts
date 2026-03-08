import { SaaSMakerClient } from '@saas-maker/sdk';

const apiKey = process.env.NEXT_PUBLIC_SAASMAKER_API_KEY;

export const saasmaker = apiKey
  ? new SaaSMakerClient({
      apiKey,
      baseUrl: process.env.NEXT_PUBLIC_SAASMAKER_API_URL || 'https://api.sassmaker.com',
    })
  : null;
