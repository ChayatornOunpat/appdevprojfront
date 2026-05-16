import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth';
import { apiUrl } from '@/lib/config';

type Problem = {
  id: number | string;
  name: string;
  progress: number;
  desc: string;
};

export default function ProblemsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const columns = useMemo(() => {
    if (width >= 1200) {
      return 4;
    }
    if (width >= 900) {
      return 3;
    }
    if (width >= 640) {
      return 2;
    }
    return 1;
  }, [width]);

  const signOut = useCallback(async () => {
    await clearAuthToken();
    router.replace('/');
  }, [router]);

  const loadProblems = useCallback(
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

        const response = await apiFetch('/problems/getquestion');
        if (response.status === 401) {
          await signOut();
          return;
        }
        if (!response.ok) {
          throw new Error(`Could not load problems. Status ${response.status}.`);
        }

        const questions = (await response.json()) as Partial<Problem>[];
        const nextItems = questions.map((question) => ({
          id: question.id ?? '',
          name: question.name ?? 'Untitled problem',
          progress: Number(question.progress ?? 0),
          desc: apiUrl(`/description/${question.id ?? ''}`),
        }));

        setItems(nextItems);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load problems.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router, signOut],
  );

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  function renderProblem({ item }: { item: Problem }) {
    const progress = Math.max(0, Math.min(100, Math.round(item.progress)));

    return (
      <View style={[styles.problemItem, { width: `${100 / columns}%` }]}>
        <View style={styles.problemCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressValue}>{progress}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Text style={styles.problemTitle} numberOfLines={2}>
            {item.name}
          </Text>

          <Pressable onPress={() => Linking.openURL(item.desc)} style={styles.linkButton}>
            <Text style={styles.linkText}>Description</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({ pathname: '/editor/[id]', params: { id: String(item.id) } })
            }
            style={({ pressed }) => [styles.codeButton, pressed && styles.pressed]}>
            <Text style={styles.codeButtonText}>Code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>IseGrader</Text>
          <Text style={styles.headerTitle}>Problems</Text>
        </View>
        <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : (
        <FlatList
          key={columns}
          data={items}
          numColumns={columns}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProblem}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadProblems(true)} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{error || 'No problems found.'}</Text>
            </View>
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f7fb',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#d7dde7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  brand: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
  },
  signOut: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  problemItem: {
    padding: 8,
  },
  problemCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dde7',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    minHeight: 220,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  progressHeader: {
    gap: 8,
  },
  progressValue: {
    color: '#0f766e',
    fontSize: 28,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0f766e',
    height: '100%',
  },
  problemTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '800',
  },
  codeButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  codeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#536171',
    fontSize: 16,
  },
  errorBanner: {
    backgroundColor: '#fef3f2',
    borderColor: '#fecdca',
    borderRadius: 8,
    borderWidth: 1,
    margin: 8,
    padding: 14,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
