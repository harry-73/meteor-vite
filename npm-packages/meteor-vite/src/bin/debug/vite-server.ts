import FS from 'fs';
import Path from 'path';
import { createServer } from 'vite';
import { MeteorStubs } from '../../vite';

const meteorRoot = Path.join(process.cwd(), '../../examples/vue');


export default createServer({
    root: meteorRoot,
    plugins: [
        MeteorStubs({
            meteor: {
                packagePath: Path.join(meteorRoot, '.meteor', 'local', 'build', 'programs', 'web.browser', 'packages'),
                isopackPath: Path.join(meteorRoot, '.meteor', 'local', 'isopacks')
            },
            projectJsonContent: JSON.parse(FS.readFileSync(Path.join(meteorRoot, 'package.json'), 'utf-8')),
        })
    ]
});