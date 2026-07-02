export interface CodeSample {
  lang: string;
  label: string;
  source: string;
}

const BASE_URL = 'https://api.example.com';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const MALL = '660e8400-e29b-41d4-a716-446655440001';

export function buildPublicCodeSamples(
  path: string,
  options?: { query?: Record<string, string>; sdkMethod?: string; sdkArgs?: string },
): CodeSample[] {
  const qs = options?.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : '';
  const url = `${BASE_URL}${path}${qs}`;

  const headersBlock = `  'x-tenant-id': '${TENANT}',\n  'x-mall-id': '${MALL}',`;

  const curl = [
    `curl -s "${url}" \\`,
    `  -H "x-tenant-id: ${TENANT}" \\`,
    `  -H "x-mall-id: ${MALL}" \\`,
    `  -H "Accept: application/json"`,
  ].join('\n');

  const fetchSample = `const response = await fetch('${url}', {
  headers: {
${headersBlock}
    Accept: 'application/json',
  },
});
const json = await response.json();`;

  const axiosSample = `import axios from 'axios';

const { data } = await axios.get('${url}', {
  headers: {
${headersBlock}
  },
});`;

  const samples: CodeSample[] = [
    { lang: 'Shell', label: 'cURL', source: curl },
    { lang: 'JavaScript', label: 'fetch', source: fetchSample },
    { lang: 'JavaScript', label: 'axios', source: axiosSample },
  ];

  if (options?.sdkMethod) {
    samples.push({
      lang: 'TypeScript',
      label: 'CmsPublicClient',
      source: buildSdkSample(options.sdkMethod, options.sdkArgs),
    });
  }

  return samples;
}

function buildSdkSample(method: string, args = "{ locale: 'tr' }"): string {
  return `import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: '${BASE_URL}',
  tenantId: '${TENANT}',
  mallId: '${MALL}',
  defaultLocale: 'tr',
});

const result = await cms.${method}(${args});`;
}

export function buildReactHookSample(hookName: string, fetchCall: string): string {
  return `'use client';

import { useEffect, useState } from 'react';

export function ${hookName}() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ${fetchCall}
        if (!cancelled) setData(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}`;
}
