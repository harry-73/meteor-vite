import Path from 'path';
import { RollupOutput } from 'rollup';
import { build, resolveConfig } from 'vite';
import { MeteorViteConfig } from '../../vite/MeteorViteConfig';
import { MeteorStubs } from '../../vite';
import MeteorVitePackage from '../../../package.json';
import InjectMeteorPrograms, { usesMeteorFrontend } from '../../vite/plugin/InjectMeteorPrograms';
import { PluginSettings, ProjectJson } from '../../vite/plugin/MeteorStubs';
import CreateIPCInterface, { IPCReply } from './IPC/interface';
import { resolveConfigFilePath } from './vite-server';

interface BuildOptions {
    viteOutDir: string;
    meteor: PluginSettings['meteor'];
    packageJson: ProjectJson;
}

type Replies = IPCReply<{
    kind: 'buildResult',
    data: {
        payload: {
            success: boolean,
            meteorViteConfig: MeteorViteConfig['meteor'],
            build: {
                outDir: string;
                originalOutDir: string;
                target: 'meteor' | 'standalone';
            }
            output?: {name?: string, type: string, fileName: string}[]
        };
    }
}>

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
        
        let viteConfig: MeteorViteConfig = await resolveConfig({
            configFile: resolveConfigFilePath(packageJson),
        }, 'build');
        
        const bundleTarget = usesMeteorFrontend(viteConfig) ? 'meteor' : 'standalone'
        const standaloneOutDir = viteConfig.build.outDir || '.vite-output';
        let outDir = viteOutDir;
        
        if (bundleTarget !== 'meteor') {
            outDir = standaloneOutDir;
        }
        
        if (!viteConfig.meteor?.clientEntry) {
            throw new Error(`You need to specify an entrypoint in your Vite config! See: ${MeteorVitePackage.homepage}`);
        }
        
        const results = await build({
            configFile: viteConfig.configFile,
            build: {
                lib: {
                    entry: viteConfig?.meteor?.clientEntry,
                    formats: ['es'],
                },
                rollupOptions: {
                    output: {
                        entryFileNames: 'meteor-entry.js',
                        chunkFileNames: '[name].js',
                    },
                },
                outDir,
                minify: false,
            },
            plugins: [
                // Get fully resolved config to feed any potential changes back to the Meteor compiler.
                // vite-plugin-ssr prefixes the output directory with the deployment target (client/server)
                // Resulting in e.g. `output/vite` turning into `output/vite/client`
                {
                    name: 'meteor-vite: config resolver',
                    configResolved: (config) => {
                        viteConfig = config
                    }
                },
                MeteorStubs({ meteor, packageJson, }),
                InjectMeteorPrograms({ meteor }),
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
        
        // Result payload
        reply({
            kind: 'buildResult',
            data: {
                payload: {
                    success: true,
                    meteorViteConfig: viteConfig.meteor,
                    build: {
                        outDir: viteConfig.build.outDir,
                        target: usesMeteorFrontend(viteConfig) ? 'meteor' : 'standalone',
                        originalOutDir: standaloneOutDir,
                    },
                    output: result.output.map(o => ({
                        name: o.name,
                        type: o.type,
                        fileName: o.fileName,
                    })),
                },
            }
        })
    }
})


