// Variable and test switch accessors (docs/plan/03-design-model.md sections 2.6 and 3). The
// built-in variables are read-only. Variables keep the bare ID name (`var_<n>` when nothing is
// usable), switches too (`switch_<n>`).
import type { SwitchId, VarId } from '../model/ids.ts'
import type { TestSwitch, Variable } from '../model/variables.ts'
import { toIdName } from '../names/id-name.ts'
import {
  change,
  fixIdName,
  followIdName,
  newId,
  setField,
  takenIdNames,
  toY,
  ystring,
  type DesignEditor,
  type DesignMaps,
  type YMap,
} from './layout.ts'

export type NewVariable = Omit<Variable, 'id' | 'idName' | 'idNameFixed'>
export type VariablePatch = Partial<Omit<Variable, 'id' | 'idName' | 'idNameFixed' | 'source'>>
export type NewSwitch = Omit<TestSwitch, 'id' | 'idName' | 'idNameFixed'>
export type SwitchPatch = Partial<Omit<TestSwitch, 'id' | 'idName' | 'idNameFixed'>>

/** Adds a variable inside a running transaction (a question's answer, a developer step's output). */
export function createVariable(maps: DesignMaps, fields: NewVariable): VarId {
  const id = newId()
  const variable: Variable = { id, idName: toIdName(fields.label, '', takenIdNames(maps), 'var_'), ...fields }
  maps.variables.set(id, toY(variable) as YMap)
  return id
}

export function variableEdits(editor: DesignEditor) {
  // A variable people may change: not a built-in one.
  const editable = (maps: DesignMaps, id: VarId) => {
    const variable = maps.variables.get(id)
    return variable && ystring(variable, 'source') !== 'builtin' ? variable : undefined
  }
  return {
    add(fields: NewVariable): VarId {
      return change(editor, (maps) => createVariable(maps, fields))
    },
    /** Changes fields (`undefined` clears one); the ID name follows the label until fixed. */
    set(id: VarId, fields: VariablePatch): boolean {
      return change(editor, (maps) => {
        const variable = editable(maps, id)
        if (!variable) return false
        for (const [key, value] of Object.entries(fields)) setField(variable, key, value)
        if (fields.label !== undefined) followIdName(maps, id, variable, fields.label, '', 'var_')
        return true
      })
    },
    setIdName(id: VarId, name: string): boolean {
      return change(editor, (maps) => {
        const variable = editable(maps, id)
        return variable ? fixIdName(maps, id, variable, name) : false
      })
    },
    /** Deletes a variable (not a built-in one); the checks report the places still using it. */
    remove(id: VarId): boolean {
      return change(editor, (maps) => {
        if (!editable(maps, id)) return false
        maps.variables.delete(id)
        return true
      })
    },
  }
}

export function switchEdits(editor: DesignEditor) {
  return {
    add(fields: NewSwitch): SwitchId {
      return change(editor, (maps) => {
        const id = newId()
        const testSwitch: TestSwitch = {
          id,
          idName: toIdName(fields.label, '', takenIdNames(maps), 'switch_'),
          ...fields,
        }
        maps.switches.set(id, toY(testSwitch) as YMap)
        return id
      })
    },
    /** Changes fields (`undefined` clears one); the ID name follows the label until fixed. */
    set(id: SwitchId, fields: SwitchPatch): boolean {
      return change(editor, (maps) => {
        const testSwitch = maps.switches.get(id)
        if (!testSwitch) return false
        for (const [key, value] of Object.entries(fields)) setField(testSwitch, key, value)
        if (fields.label !== undefined) followIdName(maps, id, testSwitch, fields.label, '', 'switch_')
        return true
      })
    },
    setIdName(id: SwitchId, name: string): boolean {
      return change(editor, (maps) => {
        const testSwitch = maps.switches.get(id)
        return testSwitch ? fixIdName(maps, id, testSwitch, name) : false
      })
    },
    /** Deletes a switch; the checks report the conditions still using it. */
    remove(id: SwitchId): boolean {
      return change(editor, (maps) => {
        if (!maps.switches.has(id)) return false
        maps.switches.delete(id)
        return true
      })
    },
  }
}
