// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'prototypes/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Phaser passe le contexte explicitement : `emitter.on(event, this.handler, this)`.
      // Ce pattern est idiomatique et sûr, la règle unbound-method produirait des faux positifs.
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-restricted-globals': ['error', 'window', 'globalThis'],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Garde-fou d'architecture : la logique pure ne dépend JAMAIS de Phaser (testable en Node).
    files: ['src/systems/**/*.ts', 'src/utils/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: 'Logique pure : pas de Phaser ici (voir claude.md).' }] },
      ],
    },
  },
  {
    // Garde-fou : seul le Preloader déclare preload(). Les autres scènes ne chargent rien.
    files: ['src/scenes/**/*.ts'],
    ignores: ['src/scenes/PreloaderScene.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MethodDefinition[key.name='preload']",
          message: 'Le chargement se fait uniquement dans PreloaderScene (manifeste des assets).',
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
