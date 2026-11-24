// The colors a member can pick on the account page (docs/plan/04 section 2): their cursor on the
// map, the outline of what they edit and their avatar (05 section 4). Ten hues of Tailwind's 600
// and 700 steps, each 4.5:1 or more against white, so white initials read on them and they stand
// out on the light and the dark map alike.
export const personColors = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink', value: '#be185d' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Green', value: '#15803d' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Cyan', value: '#0e7490' },
] as const
