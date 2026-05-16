import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'isegrader_token';
let memoryToken: string | null = null;

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined';
}

export async function getAuthToken() {
  if (Platform.OS === 'web') {
    return canUseLocalStorage() ? localStorage.getItem(TOKEN_KEY) : memoryToken;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAuthToken(token: string) {
  memoryToken = token;

  if (Platform.OS === 'web') {
    if (canUseLocalStorage()) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAuthToken() {
  memoryToken = null;

  if (Platform.OS === 'web') {
    if (canUseLocalStorage()) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
