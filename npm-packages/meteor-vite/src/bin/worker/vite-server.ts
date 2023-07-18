import OS from 'os';
import Path from 'path';
import { createServer, resolveConfig, ViteDevServer } from 'vite';
import Logger from '../../Logger';
import { MeteorRuntimeConfig } from '../../meteor/InternalTypes';
import MeteorEvents, { MeteorIPCMessage } from '../../meteor/MeteorEvents';
import { MeteorViteConfig, MeteorViteMode } from '../../vite/MeteorViteConfig';
import { MeteorStubs } from '../../vite';
import InjectMeteorPrograms from '../../vite/plugin/InjectMeteorPrograms';
import { PluginSettings, ProjectJson } from '../../vite/plugin/MeteorStubs';
import { RefreshNeeded } from '../../vite/ViteLoadRequest';
import CreateIPCInterface, { IPCReply } from './IPC/interface';
import { onTeardown } from './IPC/teardown';

let server: ViteDevServer & { config: MeteorViteConfig };
let viteConfig: MeteorViteConfig;

type Replies = IPCReply<{
    kind: 'viteConfig',
    data: {
        host?: string | boolean;
        port?: number;
        entryFile?: string;
        mode: MeteorViteMode;
    }
} | {
    kind: 'refreshNeeded',
    data: {},
}>

const runtimeConfig = {} as MeteorRuntimeConfig;

function setRuntimeConfig(config: MeteorRuntimeConfig) {
    Object.assign(runtimeConfig, { DDP_DEFAULT_CONNECTION_URL: config.DDP_DEFAULT_CONNECTION_URL ?? config.ROOT_URL }, config);
    MeteorEvents.setRuntimeConfig(config);
}

export default CreateIPCInterface({
    async 'vite.getDevServerConfig'(replyInterface: Replies) {
        sendViteConfig(replyInterface);
    },
    
    async 'meteor.ipcMessage'(reply, data: MeteorIPCMessage) {
        MeteorEvents.ingest(data);
    },
    
    async 'meteor.setRuntimeConfig'(reply, data: MeteorRuntimeConfig) {
        setRuntimeConfig(data);
    },
    
    async 'vite.startDevServer'(replyInterface: Replies, { packageJson, meteorRuntimeConfig }: {
        packageJson: ProjectJson,
        meteorRuntimeConfig: MeteorRuntimeConfig;
    }) {
        
        setRuntimeConfig(meteorRuntimeConfig);
        
        const meteor = {
            packagePath: Path.join('.meteor', 'local', 'build', 'programs', 'web.browser', 'packages'),
            isopackPath: Path.join('.meteor', 'local', 'isopacks'),
            runtimeConfig,
        } satisfies PluginSettings['meteor'];
        
        if (!server) {
            server = await createServer({
                configFile: packageJson.meteor?.viteConfig,
                plugins: [
                    MeteorStubs({ meteor, packageJson }),
                    InjectMeteorPrograms({ meteor }),
                    {
                        name: 'meteor-handle-restart',
                        buildStart () {
                            if (!listening) {
                                sendViteConfig(replyInterface);
                            }
                        },
                    },
                ],
                cacheDir: packageJson?.meteor?.tempDir || Path.resolve(OS.tmpdir(), 'meteor-vite', packageJson.name, '.vite-server'),
            });
            
            process.on('warning', (warning) => {
                if (warning.name !== RefreshNeeded.name) {
                    return;
                }
                replyInterface({
                    kind: 'refreshNeeded',
                    data: {},
                })
            })
        }
        
        onTeardown((event) => {
            Logger.warn(`Received kill signal ${event} - Closing Vite server...`)
            
            server.close().then(() => {
                Logger.warn('Vite server closed successfully');
                process.exit(0);
            });
        });
        
        let listening = false
        await server.listen()
        sendViteConfig(replyInterface);
        listening = true
    }
})

function sendViteConfig(reply: Replies) {
    if (!server) {
        Logger.debug('Tried to get config from Vite server before it has been created!');
        return;
    }
    
    const { config } = server;
    
    reply({
        kind: 'viteConfig',
        data: {
            host: config.server?.host,
            port: config.server?.port,
            entryFile: config.meteor?.clientEntry,
            mode: config.meteor?.viteMode || 'hmr',
        }
    })
}