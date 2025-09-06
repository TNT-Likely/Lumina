/**
 * Rewrite internal packages' package.json entries to point to dist for CI/build,
 * and optionally restore back to src for local dev.
 * Usage:
 *  node scripts/prepare-packages-entries.cjs toDist
 *  node scripts/prepare-packages-entries.cjs toSrc
 */
const fs = require('fs')
const path = require('path')

const root = __dirname + '/..'
const pkgsDir = path.join(root, 'packages')

const mode = process.argv[2] || 'toDist'

const packages = fs.readdirSync(pkgsDir).filter((p) => {
  try {
    return fs.statSync(path.join(pkgsDir, p)).isDirectory()
  } catch {
    return false
  }
})

for (const p of packages) {
  const file = path.join(pkgsDir, p, 'package.json')
  if (!fs.existsSync(file)) continue
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!json.name || !json.main) continue

  const isTypes = json.name === '@lumina/types'

  const toSrc = () => {
    json.main = 'src/index.ts'
    if (json.exports && json.exports['.']) {
      if (json.exports['.'].require) json.exports['.'].require = './src/index.ts'
      if (json.exports['.'].import) json.exports['.'].import = './src/index.ts'
      if (json.exports['.'].default) json.exports['.'].default = './src/index.ts'
    }
  }

  const toDist = () => {
    json.main = 'dist/index.js'
    json.types = 'dist/index.d.ts'
    if (json.exports && json.exports['.']) {
      if (json.exports['.'].require) json.exports['.'].require = './dist/index.js'
      // keep ESM import to src for type-friendly dev, but for prod it's fine to still point to src
      // as Vite/node will resolve CJS via main/require.
    }
  }

  if (mode === 'toSrc') toSrc()
  else toDist()

  // Do not change types d.ts mapping for types package
  if (isTypes) {
    // nothing extra
  }

  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
  console.log(`Rewrote ${json.name} -> main=${json.main}`)
}

console.log('Done.')
