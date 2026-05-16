import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EditorFrame,
  type EditorFrameHandle,
} from '../../components/editor/EditorFrame';
import type { EditorFrameMessage, TestCase } from '../../components/editor/createEditorHtml';
import { apiFetch, decodeCodeResponse } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth';
import { apiUrl } from '@/lib/config';

export default function EditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const problemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isWide = width >= 920;
  const editorRef = useRef<EditorFrameHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCodeRef = useRef('');
  const [initialCode, setInitialCode] = useState('');
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loaded');
  const [runtimeStatus, setRuntimeStatus] = useState('');
  const [error, setError] = useState('');

  const descriptionUrl = useMemo(() => apiUrl(`/description/${problemId ?? ''}`), [problemId]);

  const signOut = useCallback(async () => {
    await clearAuthToken();
    router.replace('/');
  }, [router]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEditor() {
      setError('');
      setIsLoading(true);

      try {
        const token = await getAuthToken();
        if (!token) {
          router.replace('/');
          return;
        }

        const [codeResponse, nameResponse, progressResponse, testsResponse] = await Promise.all([
          apiFetch(`/problems/getcode/${problemId}`),
          apiFetch(`/problems/getname/${problemId}`),
          apiFetch(`/problems/getprogress/${problemId}`),
          apiFetch(`/problems/gettestcase/${problemId}`),
        ]);

        if ([codeResponse, nameResponse, progressResponse, testsResponse].some((response) => response.status === 401)) {
          await signOut();
          return;
        }

        if (!codeResponse.ok || !nameResponse.ok || !progressResponse.ok || !testsResponse.ok) {
          throw new Error('Could not load the editor data from the server.');
        }

        const [codeText, nameText, progressText, testCases] = await Promise.all([
          codeResponse.text(),
          nameResponse.text(),
          progressResponse.text(),
          testsResponse.json() as Promise<TestCase[]>,
        ]);

        if (!isMounted) {
          return;
        }

        const decodedCode = decodeCodeResponse(codeText);
        latestCodeRef.current = decodedCode;
        setInitialCode(decodedCode);
        setName(nameText || `Problem ${problemId}`);
        setScore(Number(progressText || 0));
        setTests(Array.isArray(testCases) ? testCases : []);
        setSaveStatus('Loaded');
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the editor.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEditor();
    return () => {
      isMounted = false;
    };
  }, [problemId, router, signOut]);

  const scheduleSave = useCallback(
    (nextCode: string) => {
      latestCodeRef.current = nextCode;
      setSaveStatus('Saving...');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const response = await apiFetch(`/problems/postcode?id=${problemId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
            },
            body: latestCodeRef.current,
          });

          if (!response.ok) {
            throw new Error(`Save failed with status ${response.status}.`);
          }

          setSaveStatus('Saved');
        } catch (saveError) {
          setSaveStatus(saveError instanceof Error ? saveError.message : 'Save failed.');
        }
      }, 2000);
    },
    [problemId],
  );

  const handleSubmitResult = useCallback(
    async (nextScore: number) => {
      setScore(nextScore);
      setIsSubmitting(false);

      try {
        const response = await apiFetch(
          `/problems/postprogress?id=${problemId}&progress=${nextScore}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Progress save failed with status ${response.status}.`);
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Progress save failed.');
      }
    },
    [problemId],
  );

  const handleEditorMessage = useCallback(
    (message: EditorFrameMessage) => {
      if (message.type === 'ready') {
        setIsEditorReady(true);
        return;
      }

      if (message.type === 'codeChanged') {
        scheduleSave(message.code);
        return;
      }

      if (message.type === 'status') {
        setRuntimeStatus(message.message);
        return;
      }

      if (message.type === 'submitResult') {
        setRuntimeStatus(`Passed ${message.passed} of ${message.total} tests`);
        handleSubmitResult(message.score);
        return;
      }

      if (message.type === 'error') {
        setIsSubmitting(false);
        setError(message.message);
      }
    },
    [handleSubmitResult, scheduleSave],
  );

  function runTests() {
    setError('');
    setIsSubmitting(true);
    setRuntimeStatus('Starting tests...');
    editorRef.current?.runTests();
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
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Text style={styles.headerButtonText}>Back</Text>
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.brand}>IseGrader</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name || `Problem ${problemId}`}
          </Text>
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Text style={styles.headerButtonText}>Sign out</Text>
        </Pressable>
      </View>

      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={[styles.workspace, isWide && styles.workspaceWide]}>
        <View style={styles.editorPanel}>
          <EditorFrame
            ref={editorRef}
            initialCode={initialCode}
            tests={tests}
            onMessage={handleEditorMessage}
          />
        </View>

        <ScrollView
          style={[styles.sidePanel, isWide && styles.sidePanelWide]}
          contentContainerStyle={styles.sidePanelContent}>
          <Text style={styles.panelTitle}>{name || 'Problem'}</Text>

          <Pressable onPress={() => Linking.openURL(descriptionUrl)} style={styles.descriptionButton}>
            <Text style={styles.descriptionButtonText}>Open description</Text>
          </Pressable>

          <View style={styles.scoreBlock}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={styles.scoreValue}>{Math.round(score)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, Math.min(100, Math.round(score)))}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.statusBlock}>
            <Text style={styles.statusLabel}>Editor</Text>
            <Text style={styles.statusText}>{isEditorReady ? saveStatus : 'Loading editor...'}</Text>
          </View>

          <View style={styles.statusBlock}>
            <Text style={styles.statusLabel}>Runtime</Text>
            <Text style={styles.statusText}>{runtimeStatus || `${tests.length} tests loaded`}</Text>
          </View>

          <Pressable
            disabled={!isEditorReady || isSubmitting}
            onPress={runTests}
            style={({ pressed }) => [
              styles.submitButton,
              (!isEditorReady || isSubmitting) && styles.disabledButton,
              pressed && styles.pressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
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
  workspace: {
    flex: 1,
    gap: 12,
    padding: 12,
  },
  workspaceWide: {
    flexDirection: 'row',
  },
  editorPanel: {
    backgroundColor: '#121723',
    borderColor: '#202a3b',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 420,
    overflow: 'hidden',
  },
  sidePanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dde7',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 330,
  },
  sidePanelWide: {
    flex: 0,
    maxHeight: '100%',
    width: 320,
  },
  sidePanelContent: {
    gap: 18,
    padding: 18,
  },
  panelTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  descriptionButton: {
    alignItems: 'center',
    backgroundColor: '#eef6ff',
    borderColor: '#bfdbfe',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  descriptionButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '900',
  },
  scoreBlock: {
    gap: 8,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    color: '#536171',
    fontSize: 14,
    fontWeight: '700',
  },
  scoreValue: {
    color: '#0f766e',
    fontSize: 26,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0f766e',
    height: '100%',
  },
  statusBlock: {
    gap: 5,
  },
  statusLabel: {
    color: '#536171',
    fontSize: 12,
    fontWeight: '800',
  },
  statusText: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  errorBanner: {
    backgroundColor: '#fef3f2',
    borderBottomColor: '#fecdca',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
