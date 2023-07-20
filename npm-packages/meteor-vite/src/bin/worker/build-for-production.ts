import Path from 'path';
import { RollupOutput } from 'rollup';
import { build, PluginOption, resolveConfig } from 'vite';
import { MeteorViteConfig } from '../../vite/MeteorViteConfig';
import { MeteorStubs } from '../../vite';
import MeteorVitePackage from '../../../package.json';
import InjectMeteorPrograms from '../../vite/plugin/InjectMeteorPrograms';
import { PluginSettings, ProjectJson } from '../../vite/plugin/MeteorStubs';
import CreateIPCInterface, { IPCReply } from './IPC/interface';

import { resolveConfigFilePath } from './utils/ConfigParser';

interface BuildOptions {
    viteOutDir: string;
    meteor: PluginSettings['meteor'];
    packageJson: ProjectJson;
}

type Replies = IPCReply<{
    kind: 'buildResult',
    data: {
        payload: BuildPayload;
    }
}>

type BuildPayload = {
    success: boolean,
    meteorViteConfig: any,
    outputs?: {
        client: BuildOutput;
        server?: BuildOutput;
    };
}

type BuildOutput = {
    name?: string,
    type: string,
    absolutePath: string;
    fileName: string;
}[];

export default CreateIPCInterface({
    async buildForProduction(
        reply: Replies,
        buildConfig: BuildOptions
    ) {
        const { viteOutDir, meteor, packageJson } = buildConfig;
        
        Object.entries(buildConfig).forEach(([key, value]) => {
            if (!value) {
                throw new Error(`Vite: Worker missing required build argument "${key}"!`)
            }
        })
        
        const viteConfig: MeteorViteConfig = await resolveConfig({
            configFile: resolveConfigFilePath(packageJson),
        }, 'build');
        
        
        const plugins = [
            MeteorStubs({ meteor, packageJson, }),
            InjectMeteorPrograms({ meteor }),
        ]
        
        const outputs: BuildPayload['outputs'] = {
            client: await runBuild({
                viteOutDir,
                viteConfig,
                plugins,
                entry: viteConfig.meteor?.clientEntry || '',
            }),
            server: undefined,
        }
        
        if (viteConfig.meteor?.serverEntry) {
            outputs.server = await runBuild({
                viteOutDir,
                viteConfig,
                plugins,
                entry: viteConfig.meteor.serverEntry,
            });
        }
        
        // Result payload
        reply({
            kind: 'buildResult',
            data: {
                payload: {
                    success: true,
                    meteorViteConfig: viteConfig.meteor,
                    outputs: outputs,
                },
            }
        })
    }
})


async function runBuild({ viteConfig, viteOutDir, plugins, entry }: {
    viteConfig: MeteorViteConfig,
    viteOutDir: string;
    plugins: PluginOption[],
    entry: string;
}): Promise<BuildOutput> {
    let outDir = viteConfig.build.outDir;
    
    if (!entry) {
        throw new Error(`You need to specify an entrypoint in your Vite config! See: ${MeteorVitePackage.homepage}`);
    }
    
    const results = await build({
        configFile: viteConfig.configFile,
        build: {
            lib: {
                entry,
                formats: ['es'],
            },
            rollupOptions: {
                output: {
                    entryFileNames: 'meteor-entry.js',
                    chunkFileNames: '[name].js',
                },
            },
            outDir: viteOutDir,
            minify: false,
        },
        plugins: [
            // Get fully resolved config to feed any potential changes back to the Meteor compiler.
            // vite-plugin-ssr prefixes the output directory with the deployment target (client/server)
            // Resulting in e.g. `output/vite` turning into `output/vite/client`
            {
                name: 'meteor-vite: out-dir resolver',
                configResolved: (config) => {
                    outDir = config.build.outDir;
                }
            },
            ...plugins,
        ],
    });
    
    const result = Array.isArray(results) ? results[0] : results;
    
    function validateOutput(rollupResult: typeof result): asserts rollupResult is RollupOutput {
        if ('output' in rollupResult) {
            return;
        }
        
        const message = 'Unexpected rollup result!';
        console.error(message, rollupResult);
        throw new Error(message);
    }
    
    validateOutput(result);
    
    return result.output.map(asset => ({
        name: asset.name,
        type: asset.type,
        fileName: asset.fileName,
        absolutePath: Path.join(outDir, asset.fileName)
    }))
}

