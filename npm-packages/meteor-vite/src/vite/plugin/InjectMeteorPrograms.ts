import FS from 'fs/promises';
import Logger from '../../Logger';
import { MeteorProgram, MeteorRuntimeConfig } from '../../meteor/InternalTypes';
import MeteorEvents from '../../meteor/MeteorEvents';
import { MeteorViteConfig } from '../MeteorViteConfig';
import { PluginSettings } from './MeteorStubs';
import { Plugin } from 'vite';
import Path from 'path';

export default async function InjectMeteorPrograms(pluginSettings:  Pick<PluginSettings, 'meteor'>) {
    const bundlePath = Path.join(pluginSettings.meteor.packagePath, '../');
    const runtimeFile = Path.join(bundlePath, '__meteor_runtime_config.js');
    const virtualImports = [`import '${runtimeFile}';`, ...await getProgramImports(Path.join(bundlePath, '/program.json'))];
    let resolvedConfig: MeteorViteConfig;
    
    /**
     * Whether Vite is responsible for hosting the app's HTML or Meteor.
     * In most cases this will be Meteor, but if you only want to use Meteor as an API server rather than a full
     * stack framework and rely on Vite for hosting the frontend, supply SSR in your config.
     *
     * This will make meteor-vite try to import client bundles (packages hosted by Atmosphere, or code in your
     * Meteor client MainModule) directly from your Meteor app and serve it as a simulated Meteor app bundle.
     * @returns {boolean}
     */
    const hasMeteorFrontend = () => resolvedConfig.meteor?.viteMode !== 'ssr';
    
    
    return {
        name: 'meteor-vite: inject Meteor Programs HTML',
        configResolved(config) {
            resolvedConfig = config;
        },
        
        resolveId(id) {
            if (hasMeteorFrontend()) {
                return;
            }
            if (id.startsWith('.meteor')) {
                return `\0${id}`
            }
            if (id.startsWith('virtual:meteor-bundle')) {
                return `\0${id}`
            }
            if (id.startsWith('\0.meteor')) {
                return id;
            }
        },
        
        buildStart() {
            this.addWatchFile(runtimeFile);
            updateRuntime(runtimeFile, pluginSettings.meteor.runtimeConfig);
            
            MeteorEvents.listen('updated-runtime-config', (data) => {
                updateRuntime(runtimeFile, data);
            })
        },
        
        /**
         * Create a virtual meteor bundle for directly pulling in Meteor code into Vite.
         * This is done primarily for instances where Vite is acting as the sole user-facing server. E.g. when doing
         * SSR through Vite and Meteor is only used as a real-time API server.
         */
        async load(id) {
            if (hasMeteorFrontend()) {
                return;
            }
            id = id.slice(1);
            if (id.startsWith('virtual:meteor-bundle')) {
                return virtualImports.join('\n');
            }
            if (!id.startsWith('.meteor')) {
                return;
            }
            const filePath = Path.join(process.cwd(), id);
            let content = await FS.readFile(filePath, 'utf-8');
            if (id.endsWith('global-imports.js')) {
                content = content.split(/[\r\n]/).map((line) => line.replace(/^(\w+) =/, 'globalThis.$1 =')).join('\n');
            }
            content = meteorContext(content);
            if (content.match(/document/) && resolvedConfig.meteor?.debug) {
                const format = Path.parse(id);
                const writeDir = '.meteor-vite/injected-programs';
                const writePath = Path.join(writeDir, `${format.name}${format.ext}`);
                await FS.mkdir(writeDir, { recursive: true });
                await FS.writeFile(writePath, content);
            }
            return content;
        },
        
    } satisfies Plugin;
}

async function getProgramImports(programJsonPath: string) {
    const program: MeteorProgram = JSON.parse(await FS.readFile(programJsonPath, 'utf-8'));
    const virtualImports: string[] = [];
    
    program.manifest.forEach((entry) => {
        if (entry.type === 'js') {
            virtualImports.push(`import '\0${Path.join(programJsonPath, '../', entry.path).replace(/^\/+/, '')}';`)
        }
    });
    
    return virtualImports;
}

async function updateRuntime(runtimeFilePath: string, config: MeteorRuntimeConfig) {
    // language=js
    const template = `globalThis.__meteor_runtime_config__ = ${JSON.stringify(config)}`;
    Logger.info('Writing new Runtime config: %s', config?.autoupdate?.versions?.['web.browser']?.version);
    await FS.writeFile(runtimeFilePath, template);
}

/**
 * Stub out a simulation for a Meteor client environment.
 * This is just enough to allow the Meteor core packages to load without breaking the server, but it's far from optimal.
 */
function meteorContext(moduleContent: string) {
    // https://regex101.com/r/gb8IiO/1
    const template = moduleContent.replace(/(}\))\(\);(?!.{4})/ms, '$1.call(context)')
                                  .replace('var proc = global.process', 'var proc = {}')
    // language=js
    return `
const context = (()=>{
        if (typeof globalThis !== 'undefined') {
            return globalThis;
        } else if (typeof self !== 'undefined') {
            return self;
        } else if (typeof window !== 'undefined') {
            return window;
        } else {
            return Function('return this')();
        }
    }
)();
const document = Object.assign(context.document || {}, {
    addEventListener: () => null,
    getElementsByTagName: () => ({
        item: () => {},
    })
});
let navigator = undefined;
const window = typeof context.window !== 'undefined' ? context.window : document;
(function () {
${template}
}).call(context);
`
}