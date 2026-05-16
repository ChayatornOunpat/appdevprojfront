import { Platform } from 'react-native';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

const defaultBaseUrl = Platform.select({
  android: 'http://10.0.2.2:5029',
  default: 'http://localhost:5029',
});

export const API_BASE_URL = configuredBaseUrl || defaultBaseUrl;

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
