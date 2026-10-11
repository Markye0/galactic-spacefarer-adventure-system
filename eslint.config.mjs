import cds from '@sap/cds/eslint.config.mjs'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['@cds-models/', 'gen/'] },
  ...cds.recommended,
  ...tseslint.configs.recommended,
]
