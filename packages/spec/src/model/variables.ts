// Variables and test switches (docs/plan/03-design-model.md section 2.6). The built-in variables
// (first_name, last_name, username, user_id, language, is_premium) are ordinary variables with
// source `builtin`.
import { z } from 'zod'

import { IdNameSchema, SwitchIdSchema, VarIdSchema } from './ids.ts'

export const VariableTypeSchema = z.enum([
  'text',
  'number',
  'yesNo',
  'phone',
  'location',
  'file',
  'users',
  'chat',
  'poll',
])
export type VariableType = z.infer<typeof VariableTypeSchema>

export const VariableSourceSchema = z.enum(['question', 'remember', 'devStep', 'button', 'startLink', 'builtin'])
export type VariableSource = z.infer<typeof VariableSourceSchema>

export const VariableSchema = z.object({
  id: VarIdSchema,
  // Variables keep the bare name, without a prefix.
  idName: IdNameSchema,
  // True once the ID name was edited by hand or exported; until then it follows the label.
  idNameFixed: z.boolean().optional(),
  label: z.string(),
  type: VariableTypeSchema,
  source: VariableSourceSchema,
  description: z.string().optional(),
  // The value Try it starts with.
  testValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
})
export type Variable = z.infer<typeof VariableSchema>

// A fact about the user only the developer knows ("User is admin"), used by "If" boxes and set in
// Try it.
export const TestSwitchSchema = z.object({
  id: SwitchIdSchema,
  idName: IdNameSchema,
  // True once the ID name was edited by hand or exported; until then it follows the label.
  idNameFixed: z.boolean().optional(),
  label: z.string(),
  type: z.enum(['yesNo', 'choice']),
  // The choices of a `choice` switch.
  options: z.array(z.string()).optional(),
  testValue: z.union([z.boolean(), z.string()]),
  // How the developer knows it.
  description: z.string().optional(),
})
export type TestSwitch = z.infer<typeof TestSwitchSchema>
