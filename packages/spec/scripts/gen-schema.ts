// make gen-schema, a step of make gen (docs/plan/03-design-model.md section 6.1): prints the JSON
// Schema of spec.json format version 1, Zod 4's own output of SpecSchema, which the Makefile
// writes to packages/spec/schema/bot-spec.v1.schema.json. The file is
// committed, make sanity's drift check compares it with a fresh make gen, and every export copies
// it as bot-spec.schema.json.
import { specJsonSchema } from '../src/export/schema.ts'

process.stdout.write(JSON.stringify(specJsonSchema(), null, 2) + '\n')
