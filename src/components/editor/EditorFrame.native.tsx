import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import {
  createEditorHtml,
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
  const webViewRef = useRef<WebView>(null);
  const source = useMemo(
    () => ({ html: createEditorHtml(initialCode, tests), baseUrl: 'https://localhost' }),
    [initialCode, tests],
  );

  useImperativeHandle(ref, () => ({
    runTests() {
      webViewRef.current?.injectJavaScript(
        'window.ISEGraderEditor && window.ISEGraderEditor.runTests(); true;',
      );
    },
  }));

  function handleMessage(event: WebViewMessageEvent) {
    try {
      onMessage(JSON.parse(event.nativeEvent.data) as EditorFrameMessage);
    } catch {
      onMessage({
        source: 'isegrader-editor',
        type: 'error',
        message: 'The editor sent an unreadable message.',
      });
    }
  }

  return (
    <WebView
      ref={webViewRef}
      source={source}
      style={[styles.webView, style]}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      onMessage={handleMessage}
    />
  );
});

const styles = StyleSheet.create({
  webView: {
    backgroundColor: '#121723',
    flex: 1,
  },
});
