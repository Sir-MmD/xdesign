// drizzle-kit's settings: `make gen` (drizzle-kit generate) writes a migration into migrations/
// for each change of src/db/schema.ts; the server and `cli.mjs migrate` run them.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
})
