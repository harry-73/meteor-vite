import FS from 'fs/promises';
import Path from 'path';
import pc from 'picocolors';
import { HtmlTagDescriptor, Plugin } from 'vite';
import PackageJSON from '../../../package.json';
import { MeteorManifest, MeteorProgram, MeteorRuntimeConfig } from '../../meteor/InternalTypes';
import MeteorPackage from '../../meteor/package/components/MeteorPackage';
import { stubTemplate } from '../../meteor/package/StubTemplate';
import { createErrorHandler } from '../error/ErrorHandler';
import { MeteorViteError } from '../error/MeteorViteError';
import { MeteorViteConfig, StubValidationSettings } from '../MeteorViteConfig';
import ViteLoadRequest from '../ViteLoadRequest';

export const MeteorStubs = setupPlugin(async (pluginSettings: PluginSettings) => {
    if (!pluginSettings?.packageJson?.meteor?.mainModule?.client) {
        throw new MeteorViteError(`You need to specify a Meteor entrypoint in your package.json!`, {
            subtitle: `See the following link for more info: ${PackageJSON.homepage}`
        })
    }
    
    let resolvedConfig: MeteorViteConfig;
    
    return {
        name: 'meteor-vite: stubs',
        resolveId: (id) => ViteLoadRequest.resolveId(id),
        shouldProcess: (viteId) => ViteLoadRequest.isStubRequest(viteId),
        async setupContext(viteId) {
            return ViteLoadRequest.prepareContext({ id: viteId, pluginSettings });
        },
        configResolved(config) {
            resolvedConfig = config;
        },
        
        /**
         * When acting as the frontend server in place of Meteor, inject Meteor's package import scripts into the
         * server-rendered page.
         */
        async transformIndexHtml() {
            const path = Path.join(pluginSettings.meteor.packagePath, '../program.json');
            const program: MeteorProgram = JSON.parse(await FS.readFile(path, 'utf-8'));
            let imports: HtmlTagDescriptor[] = [];
            
            const assetUrl = (manifest: MeteorManifest) => {
                const base = pluginSettings.meteor.runtimeConfig.ROOT_URL.replace(/^\/*/, '');
                const path = manifest.url.replace(/^\/*/, '');
                return `${base}${path}`;
            }
            
            imports.push({ tag: 'script', attrs: { type: 'text/javascript', src: 'http://localhost:3000/__meteor_runtime_config.js' } })
            
            program.manifest.forEach((asset) => {
                if (asset.type === 'css') {
                    imports.push({ tag: 'link', injectTo: 'head', attrs: { href: assetUrl(asset), rel: 'stylesheet' } })
                }
                if (asset.type === 'js') {
                    imports.push({ tag: 'script', injectTo: 'head', attrs: { type: 'text/javascript', src: assetUrl(asset) } })
                }
            })
            
            return imports;
        },
        
        async load(request) {
            const timeStarted = Date.now();
            
            if (request.isLazyLoaded) {
                await request.forceImport();
            }
            
            const meteorPackage = await MeteorPackage.parse({
                filePath: request.context.file.sourcePath,
                fileContent: request.context.file.content,
            });
            
            const template = stubTemplate({
                requestId: request.context.id,
                importPath: request.requestedModulePath,
                stubValidation: resolvedConfig.meteor?.stubValidation,
                meteorPackage,
            })
            
            request.log.debug(`Meteor stub created`, {
                'Parse time': meteorPackage.meta.timeSpent,
                'Request duration': `${Date.now() - timeStarted}ms`,
            });
            
            if (pluginSettings.debug) {
                await storeDebugSnippet({ request, stubTemplate: template })
            }
            
            return template;
        },
    }
})

async function storeDebugSnippet({ request, stubTemplate }: {
    request: ViteLoadRequest,
    stubTemplate: string
}) {
    const baseDir = Path.join(process.cwd(), '.meteor-vite', request.context.file.packageId.replace(':', '_'));
    const templatePath = Path.join(baseDir, request.context.file.importPath || '', 'template.js');
    const packagePath = Path.join(baseDir, 'package.js');
    
    await FS.mkdir(Path.dirname(templatePath), { recursive: true });
    
    await Promise.all([
        FS.writeFile(templatePath, stubTemplate),
        FS.writeFile(packagePath, await request.context.file.content),
    ]);
    
    request.log.info('Stored debug snippets', {
        File: pc.cyan(baseDir),
    })
}

/**
 * Vite plugin options wrapper.
 * Just a utility to set up catch blocks for nicer error handling as well as pre-populating the load() handler with
 * the request context from {@link ViteLoadRequest}.
 */
function setupPlugin<Context extends ViteLoadRequest, Settings>(setup: (settings: Settings) => Promise<{
    name: string;
    load(request: Context): Promise<string>;
    setupContext(viteId: string): Promise<Context>;
    shouldProcess(viteId: string): boolean;
    resolveId(viteId: string): string | undefined;
} & Omit<Plugin, 'load' | 'resolveId'>>): (settings: Settings) => Promise<Plugin> {
    const createPlugin = async (settings: Settings): Promise<Plugin> => {
        const { load, shouldProcess, setupContext, ...plugin } = await setup(settings);
        return {
            async load(viteId: string) {
                if (!shouldProcess(viteId)) {
                    return;
                }
                
                const request = await setupContext(viteId);
                
                return load(request).catch(
                    createErrorHandler('Could not parse Meteor package', request)
                )
            },
            
            ...plugin,
        }
    }
    
    return (settings: Settings) => createPlugin(settings).catch(createErrorHandler('Could not set up Vite plugin!'))
}


export interface PluginSettings {
    
    meteor: {
        /**
         * Path to Meteor's internal package cache.
         * This can change independently of the isopack path depending on whether we're building for production or
         * serving up the dev server.
         *
         * @example {@link /examples/vue/.meteor/local/build/programs/web.browser/packages}
         */
        packagePath: string;
        
        /**
         * Path to Meteor's Isopacks store. Used to determine where a package's mainModule is located and whether
         * the package has lazy-loaded modules. During production builds this would be pulled from a temporary
         * Meteor build, so that we have solid metadata to use when creating Meteor package stubs.
         *
         * @example {@link /examples/vue/.meteor/local/isopacks/}
         */
        isopackPath: string;
        
        /**
         * Meteor's client-side runtime config.
         * Used for enabling SSR with Vite.
         */
        runtimeConfig: MeteorRuntimeConfig;
    }
    
    /**
     * Full content of the user's Meteor project package.json.
     * Like the one found in {@link /examples/vue/package.json}
     */
    packageJson: ProjectJson;
    
    /**
     * Enabling debug mode will write all input and output files to a `.meteor-vite` directory.
     * Handy for quickly assessing how things are being formatted, or for writing up new test sources.
     */
    debug?: boolean;
    
}

/**
 * The user's Meteor project package.json content.
 * todo: expand types
 */
export type ProjectJson = {
    meteor: {
        mainModule: {
            client: string;
        },
        viteConfig?: string;
    }
}
