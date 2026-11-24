// Formatting of the whole repository (copied from xWriter's web/prettier.config.js); `make lint`
// runs `prettier --check`. Generated files and the Markdown documents are listed in .prettierignore.

/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  semi: false,
  singleQuote: true,
  printWidth: 120,
  plugins: ['prettier-plugin-tailwindcss'],
  // Tailwind 4: the class order comes from the stylesheet that loads Tailwind.
  tailwindStylesheet: './apps/web/src/styles/index.css',
  // Also sort the classes passed to these helpers.
  tailwindFunctions: ['cn', 'cva'],
}

export default config
