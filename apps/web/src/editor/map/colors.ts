// The colors of notes and sections on the map (docs/plan/03, As built M1: the model keeps a plain
// name, the editor's palette decides). A new note is yellow, a new section gray; a name the
// palette does not know shows gray. LOGIC-01's Note and Section forms offer these.
export const MAP_COLORS = {
  gray: '#8e8e93',
  yellow: '#f2b600',
  orange: '#ff9500',
  red: '#ff3b30',
  pink: '#ff2d55',
  purple: '#af52de',
  blue: '#0a84ff',
  green: '#34c759',
} as const satisfies Record<string, string>

export type MapColor = keyof typeof MAP_COLORS

/** The color of a name. */
export function mapColor(name: string): string {
  return name in MAP_COLORS ? MAP_COLORS[name as MapColor] : MAP_COLORS.gray
}

/** The color mixed into the background at a share (a section's fill, a note's paper). */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${String(percent)}%, transparent)`
}
