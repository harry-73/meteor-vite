import FS from 'node:fs'
import Path from 'node:path'
import { createServer } from 'vite'
import { MeteorStubs } from '../../vite'

const meteorRoot = Path.join(process.cwd(), '../../examples/vue')

export default createServer({
  root: meteorRoot,
  plugins: [
    MeteorStubs({
      meteor: {
        packagePath: Path.join(meteorRoot, '.meteor', 'local', 'build', 'programs', 'web.browser', 'packages'),
        globalMeteorPackagesDir: Path.join(), // todo
        isopackPath: Path.join(), // todo
      },
      packageJson: JSON.parse(FS.readFileSync(Path.join(meteorRoot, 'package.json'), 'utf-8'))
    }),
  ],
})
