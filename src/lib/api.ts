import { apiUrl } from '@/lib/config';

import { getAuthToken } from './auth';

type ApiFetchOptions = Omit<RequestInit, 'headers'> & {
  authenticated?: boolean;
  headers?: Record<string, string>;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { authenticated = true, headers: optionHeaders, ...fetchOptions } = options;
  const headers: Record<string, string> = { ...(optionHeaders ?? {}) };

  headers['ngrok-skip-browser-warning'] = 'true';

  if (authenticated) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(apiUrl(path), {
    ...fetchOptions,
    headers,
  });
}

export function decodeCodeResponse(text: string) {
  if (!text) {
    return '';
  }

  let decoded = text;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') {
      decoded = parsed;
    }
  } catch {
    decoded = text;
  }

  return decoded.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\n/g, '\n');
}
