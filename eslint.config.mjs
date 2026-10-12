import cds from '@sap/cds/eslint.config.mjs'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['@cds-models/', 'gen/'] },
  ...cds.recommended,
  ...tseslint.configs.recommended,
  // Last, so it switches off every rule that would conflict with Prettier
  prettier,
]
