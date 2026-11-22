import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export type Size = { width: number; height: number };

/**
 * Size for a pattern: the explicit width/height when given, otherwise the measured size of
 * the wrapping View (pass `onLayout` to it). Returns 0×0 until measured.
 */
export function useLayoutSize(width?: number, height?: number) {
  const [measured, setMeasured] = useState<Size>({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (Math.abs(w - measured.width) > 0.5 || Math.abs(h - measured.height) > 0.5) {
      setMeasured({ width: Math.round(w), height: Math.round(h) });
    }
  };
  return {
    width: width ?? measured.width,
    height: height ?? measured.height,
    onLayout,
  };
}
