import FS from 'fs/promises';
import Path from 'path';
import { Plugin } from 'vite';
import Logger from '../../Logger';
import { MeteorProgram, MeteorRuntimeConfig } from '../../meteor/InternalTypes';
import MeteorEvents from '../../meteor/MeteorEvents';
import { MeteorViteConfig, MeteorViteMode } from '../MeteorViteConfig';
import { PluginSettings } from './MeteorStubs';

export const METEOR_CLIENT_IMPORTS_MODULE = 'virtual:meteor-bundle';
export const DEFAULT_METEOR_VITE_MODE = 'bundler' as const;

/**
 * Inject Meteor's client bundle into the final Vite bundle.
 * This only applies when Vite is used as an exclusive frontend for your Meteor app.
 * {@link MeteorViteMode frontend/ssr mode}
 */
export default async function InjectMeteorPrograms(pluginSettings:  Pick<PluginSettings, 'meteor'>) {
    const bundlePath = Path.join(pluginSettings.meteor.packagePath, '../');
    const runtimeFile = Path.join(bundlePath, '__meteor_runtime_config.js');
    const virtualImports = [`import '${runtimeFile}';`, ...await getProgramImports(Path.join(bundlePath, '/program.json'))];
    let resolvedConfig: MeteorViteConfig;
    
    
    
    return {
        name: 'meteor-vite: inject Meteor Programs HTML',
        configResolved(config) {
            resolvedConfig = config;
        },
        
        resolveId(id) {
            if (usesMeteorFrontend(resolvedConfig)) {
                return;
            }
            if (id.startsWith(METEOR_CLIENT_IMPORTS_MODULE)) {
                return `\0${id}`
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
            id = id.slice(1);
            if (usesMeteorFrontend(resolvedConfig)) {
                return;
            }
            if (!id.startsWith(METEOR_CLIENT_IMPORTS_MODULE)) {
                return;
            }
            if (id === METEOR_CLIENT_IMPORTS_MODULE) {
                return virtualImports.join('\n');
            }
            const relativeModulePath = id.replace(`${METEOR_CLIENT_IMPORTS_MODULE}/`, '');
            const filePath = Path.join(bundlePath, relativeModulePath);
            let content = await FS.readFile(filePath, 'utf-8');
            
            if (id.endsWith('global-imports.js')) {
                content = content.split(/[\r\n]/).map((line) => line.replace(/^(\w+) =/, 'globalThis.$1 =')).join('\n');
            }
            
            content = addGlobalContextStubs(content);
            
            if (resolvedConfig.meteor?.viteMode === 'ssr') {
                content = stubForSSR(content);
            }
            
            if (resolvedConfig.meteor?.debug) {
                const format = Path.parse(id);
                const writeDir = `.meteor-vite/${resolvedConfig.meteor.viteMode}/injected-programs`;
                const writePath = Path.join(writeDir, `${format.name}${format.ext}`);
                await FS.mkdir(writeDir, { recursive: true });
                await FS.writeFile(writePath, content);
            }
            
            return content;
        },
        
    } satisfies Plugin;
}

/**
 * Build up a master "imports" file for importing every client-side module exported by Meteor.
 * This is the contents of the {@link METEOR_CLIENT_IMPORTS_MODULE} module
 */
async function getProgramImports(programJsonPath: string) {
    const program: MeteorProgram = JSON.parse(await FS.readFile(programJsonPath, 'utf-8'));
    const virtualImports: string[] = [];
    
    program.manifest.forEach((entry) => {
        if (entry.type === 'js') {
            virtualImports.push(`import '${METEOR_CLIENT_IMPORTS_MODULE}/${entry.path}';`)
        }
    });
    
    return virtualImports;
}

/**
 * Update the global __meteor_runtime_config__ variable with new data from Meteor.
 * This is a variable normally injected directly into the HTML by Meteor to configure the client, and changes with
 * every change to the client mainModule. Updating this is important to prevent Meteor's "autoupdate" package from
 * indefinitely refreshing the page to get an up-to-date config.
 */
async function updateRuntime(runtimeFilePath: string, config: MeteorRuntimeConfig) {
    // language=js
    const template = `globalThis.__meteor_runtime_config__ = ${JSON.stringify(config)}`;
    Logger.info('Writing new Runtime config: %s', config?.autoupdate?.versions?.['web.browser']?.version);
    await FS.writeFile(runtimeFilePath, template);
}


/**
 * Add stubs for the global context expected by Meteor's client bundles.
 * This is necessary as Meteor expects `this` to be bound to the browser's global `window` context. But modules
 * imported by Vite have `this` set to undefined and don't bind to the global context.
 *
 * So here we just bind "window" (or "global" for SSR) to the bundle's "this" context.
 */
function addGlobalContextStubs(moduleContent: string) {
    // https://regex101.com/r/gb8IiO/1
    const template = moduleContent.replace(/(}\))\(\);(?!.{4})/ms, '$1.call(context)')
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
(function () {
${template}
}).call(context);
`
}

/**
 * Stub out a simulation for a Meteor client environment.
 * This is just enough to allow the Meteor core packages to load without breaking the server, but it's far from optimal,
 * as we're only supplying empty placeholder objects for browser context APIs not available on the server.
 */
function stubForSSR(moduleContent: string) {
    const template = moduleContent.replace('var proc = global.process', 'var proc = {}');
    // language=js
    return `
// SSR Stubs
const document = Object.assign(context.document || {}, {
    addEventListener: () => null,
    getElementsByTagName: () => ({
        item: () => {},
    })
});
let navigator = undefined;
const window = typeof context.window !== 'undefined' ? context.window : document;

${template}
`
}

/**
 * Whether Vite is responsible for hosting the app's HTML or Meteor.
 * In most cases this will be Meteor, but if you only want to use Meteor as an API server rather than a full
 * stack framework and rely on Vite for hosting the frontend, supply 'ssr' or 'frontend' in your config.
 *
 * This will make meteor-vite try to import client bundles (packages hosted by Atmosphere, and code in your
 * Meteor client MainModule) directly from your Meteor app and serve it as a simulated Meteor app bundle.
 * @returns {boolean}
 */
export function usesMeteorFrontend(resolvedConfig: MeteorViteConfig) {
    return isViteMode(['bundler'], resolvedConfig);
}

export function isViteMode<TMode extends MeteorViteMode[]>(
    mode: TMode,
    resolvedConfig: MeteorViteConfig,
): resolvedConfig is Omit<MeteorViteConfig, 'meteor'> & { meteor: Omit<MeteorViteConfig['meteor'], 'viteMode'> & { viteMode: TMode[number] } } {
    if (mode.includes(resolvedConfig.meteor?.viteMode || DEFAULT_METEOR_VITE_MODE)) {
        return true;
    }
    return false;
}