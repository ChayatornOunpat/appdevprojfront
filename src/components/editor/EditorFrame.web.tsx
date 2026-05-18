import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  createEditorHtml,
  EDITOR_MESSAGE_SOURCE,
  type EditorFrameMessage,
  type TestCase,
} from '@/components/editor/createEditorHtml';

export type EditorFrameHandle = {
  runTests: () => void;
};

type EditorFrameProps = {
  initialCode: string;
  tests: TestCase[];
  onMessage: (message: EditorFrameMessage) => void;
  style?: StyleProp<ViewStyle>;
};

export const EditorFrame = forwardRef<EditorFrameHandle, EditorFrameProps>(function EditorFrame(
  { initialCode, tests, onMessage, style },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const srcDoc = useMemo(() => createEditorHtml(initialCode, tests), [initialCode, tests]);

  useImperativeHandle(ref, () => ({
    runTests() {
      iframeRef.current?.contentWindow?.postMessage(
        { source: EDITOR_MESSAGE_SOURCE, type: 'run-tests' },
        '*',
      );
    },
  }));

  useEffect(() => {
    function handleWindowMessage(event: MessageEvent) {
      const data = event.data as EditorFrameMessage | undefined;
      if (!data || data.source !== EDITOR_MESSAGE_SOURCE) {
        return;
      }

      onMessage(data);
    }

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [onMessage]);

  return (
    <View style={[styles.container, style]}>
      {React.createElement('iframe', {
        ref: iframeRef,
        title: 'Grinder code editor',
        srcDoc,
        sandbox: 'allow-scripts allow-same-origin',
        style: styles.iframe,
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  iframe: {
    backgroundColor: '#121723',
    borderWidth: 0,
    height: '100%',
    width: '100%',
  },
});
