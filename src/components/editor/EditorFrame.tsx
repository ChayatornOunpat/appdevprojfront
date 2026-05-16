import React, { forwardRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { EditorFrameMessage, TestCase } from './createEditorHtml';

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
  { style },
  _ref,
) {
  return <View style={style} />;
});
