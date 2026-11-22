/** Two projects: pure Node logic (db, lib, pdf templates) and React Native components. */
module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.node.test.ts'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^expo-crypto$': '<rootDir>/src/test/expoCryptoMock.ts',
      },
    },
    {
      displayName: 'rn',
      preset: 'jest-expo/android',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.rn.test.tsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
