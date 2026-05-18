import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth';
import { apiUrl } from '@/lib/config';

type ResourceFile = {
  filename: string;
  title: string;
  size: number;
  updatedAt: string;
  url: string;
};

export default function ResourceScreen() {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const signOut = useCallback(async () => {
    await clearAuthToken();
    router.replace('/');
  }, [router]);

  const loadResources = useCallback(
    async (refreshing = false) => {
      setError('');
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const token = await getAuthToken();
        if (!token) {
          router.replace('/');
          return;
        }

        const response = await apiFetch('/resources');
        if (response.status === 401) {
          await signOut();
          return;
        }
        if (!response.ok) {
          throw new Error(`Could not load resources. Status ${response.status}.`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error('Could not load resources from the server.');
        }

        const payload = (await response.json()) as Partial<ResourceFile>[];
        setResources(
          Array.isArray(payload)
            ? payload.map((item) => ({
                filename: item.filename ?? '',
                title: item.title ?? item.filename ?? 'Resource',
                size: Number(item.size ?? 0),
                updatedAt: item.updatedAt ?? '',
                url: item.url ?? '',
              }))
            : [],
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load resources.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router, signOut],
  );

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/problems');
  }

  function openResource(resource: ResourceFile) {
    if (!resource.url) {
      return;
    }

    Linking.openURL(apiUrl(resource.url)).catch(() => undefined);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerContent}>
          <ActivityIndicator color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Text style={styles.headerButtonText}>Back</Text>
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.brand}>Grinder</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Resources
          </Text>
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Text style={styles.headerButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadResources(true)} />
        }>
        <View style={styles.intro}>
          <Text style={styles.title}>Resource files</Text>
          <Text style={styles.subtitle}>
            PDF materials provided by the Grinder backend.
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.linkList}>
          {resources.map((resource) => (
            <View key={resource.filename} style={styles.linkCard}>
              <View style={styles.linkTextGroup}>
                <Text style={styles.fileMeta}>PDF</Text>
                <Text style={styles.linkTitle}>{resource.title}</Text>
                <Text style={styles.linkDescription}>
                  {formatBytes(resource.size)}
                  {resource.updatedAt ? ` - Updated ${formatDate(resource.updatedAt)}` : ''}
                </Text>
              </View>

              <Pressable
                disabled={!resource.url}
                onPress={() => openResource(resource)}
                style={({ pressed }) => [
                  styles.openButton,
                  !resource.url && styles.disabledButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.openButtonText}>Open</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {!resources.length && !error && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No resource files found.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown date';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f7fb',
    flex: 1,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#d7dde7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  brand: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  headerTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    maxWidth: '100%',
  },
  headerButton: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    gap: 18,
    maxWidth: 900,
    padding: 24,
    width: '100%',
  },
  intro: {
    gap: 8,
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    color: '#536171',
    fontSize: 16,
    lineHeight: 24,
  },
  linkList: {
    gap: 10,
  },
  linkCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dde7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  linkTextGroup: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  fileMeta: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
  },
  linkTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  linkDescription: {
    color: '#536171',
    fontSize: 14,
    lineHeight: 20,
  },
  openButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    minWidth: 78,
    paddingHorizontal: 14,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  errorBanner: {
    backgroundColor: '#fef3f2',
    borderColor: '#fecdca',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#536171',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});
