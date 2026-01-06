// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  rules: {
    // Disable exhaustive-deps for reanimated shared values
    // useSharedValue returns stable refs that don't need to be in dependency arrays
    'react-hooks/exhaustive-deps': 'off',
  },
};
