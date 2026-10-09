// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'prototypes/**', 'site/**'] },
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
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
        {
          paths: [
            { name: 'phaser', message: 'Logique pure : pas de Phaser ici (voir claude.md).' },
          ],
        },
      ],
    },
  },
  {
    // Migration 3D (docs/ARCHITECTURE.md § 12) : la simulation est pure (ni Phaser, ni three, ni DOM)
    // et déterministe (aléatoire injecté, temps de la sim uniquement).
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'Simulation pure : pas de Phaser ici.' },
            { name: 'three', message: 'Simulation pure : le rendu vit dans src/view/.' },
          ],
          patterns: [
            { group: ['three/*'], message: 'Simulation pure : le rendu vit dans src/view/.' },
            {
              group: [
                '@/view/*',
                '@/ui/*',
                '@/engine/*',
                '@/scenes/*',
                '@/scenes3d/*',
                '@/entities/*',
                '@/fx/*',
              ],
              message:
                "La simulation ne connaît ni la vue, ni l'UI, ni le moteur, ni la version Phaser.",
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'globalThis',
        'document',
        'performance',
        'requestAnimationFrame',
        'localStorage',
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Aléatoire injecté (createRng) : la simulation est rejouable.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Temps de la simulation uniquement (SimWorld.now).',
        },
      ],
    },
  },
  {
    // La vue 3D ne dépend ni de l'UI DOM, ni de Phaser, ni des scènes.
    files: ['src/view/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'La vue 3D est en Three.js.' }],
          patterns: [
            {
              group: ['@/ui/*', '@/scenes/*', '@/scenes3d/*', '@/entities/*', '@/fx/*'],
              message:
                "La vue ne connaît pas l'UI ni les scènes : seules les scènes assemblent les couches.",
            },
          ],
        },
      ],
    },
  },
  {
    // L'UI DOM de la 3D et la plomberie navigateur n'utilisent jamais three.
    files: [
      'src/ui/hud/**/*.ts',
      'src/ui/menus/**/*.ts',
      'src/ui/hub/**/*.ts',
      'src/engine/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'UI et moteur en DOM : three ne vit que dans src/view/.' },
            { name: 'phaser', message: 'Entrée 3D : pas de Phaser.' },
          ],
          patterns: [
            {
              group: ['three/*', '@/view/*'],
              message: 'UI et moteur en DOM : three ne vit que dans src/view/.',
            },
          ],
        },
      ],
    },
  },
  {
    // L'audio (Web Audio) lit la sim mais ne dépend ni du rendu, ni de l'UI, ni des scènes.
    files: ['src/audio/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: "L'audio n'utilise pas three." },
            { name: 'phaser', message: 'Entrée 3D : pas de Phaser.' },
          ],
          patterns: [
            {
              group: ['three/*', '@/view/*', '@/ui/*', '@/scenes/*', '@/scenes3d/*', '@/engine/*'],
              message:
                "L'audio s'abonne aux événements de la sim ; seules les scènes l'assemblent.",
            },
          ],
        },
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
