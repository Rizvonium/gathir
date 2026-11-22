/**
 * Global mocks for the jest-expo (`*.rn.test.tsx`) project.
 * Reanimated 4's own Jest mock boots the native worklets runtime, which Jest cannot load,
 * so components render with a small stand-in where animations jump to their end values.
 * A test file may still override any of these with its own jest.mock().
 */
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a),
  scheduleOnUI: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a),
}));
jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
