import next from 'eslint-config-next/core-web-vitals';

// ESLint 9 flat config. eslint-config-next 16 ships a native flat-config array,
// so spread it directly — no FlatCompat bridge needed.
const eslintConfig = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
  },
  {
    // eslint-config-next 16 ships the React-Compiler-aware react-hooks v6 rules
    // as errors. They flag long-standing, correct patterns in this codebase
    // (e.g. the `mounted`-gate `useEffect(() => setMounted(true), [])` used for
    // SSR hydration). Keep them visible as warnings rather than rewrite working
    // code; revisit when adopting the React Compiler.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default eslintConfig;
