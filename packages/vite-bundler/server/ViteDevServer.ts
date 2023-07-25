import { Meteor } from 'meteor/meteor';
import {
    buildConnectionUri,
    DevConnectionLog,
    getConfig,
    setConfig,
} from '../loading/vite-connection-handler';
import { createWorkerFork, getProjectPackageJson, isMeteorIPCMessage } from '../workers';
import { WebApp } from 'meteor/webapp';
import { MeteorViteRuntime } from './MeteorViteRuntime';

export default class ViteDevServer {
    protected server?: ReturnType<typeof createWorkerFork>;
    
    constructor(public readonly runtime: MeteorViteRuntime) {
        this.bindEventListeners();
    }
    
    public start() {
        if (this.server) {
            DevConnectionLog.info('Meteor tried to create more than one instance of the Vite dev server!');
            return;
        }
        
        this.server = this.createServer();
    }
    
    public stop() {
        DevConnectionLog.info('Shutting down Vite server...');
        this.server?.call({
            method: 'ipc.teardown',
            params: [],
        });
        delete this.server;
    }
    
    /**
     * Force a renewal of the locally stored Vite dev server config.
     * We use this to transmit any potential changes directly to the client through DDP. Used primarily for the
     * startup splash screen.
     */
    public refreshConfig() {
        DevConnectionLog.info('Refreshing configuration from Vite dev server...');
        this.server?.call({
            method: 'vite.getDevServerConfig',
            params: [],
        });
        return getConfig();
    }
    
    /**
     * Spawn a new meteor-vite dev server worker thread.
     */
    protected createServer() {
        DevConnectionLog.info('Starting Vite server...');
        let emittedReadyState = false;
        const viteServer = createWorkerFork({
            viteConfig(config) {
                const newConfig = setConfig(config);
                if (newConfig.ready && emittedReadyState) {
                    return;
                }
                emittedReadyState = true;
                const dataLine = `    %s:\t%s\t\x1b[2m(%s)\x1b[22m`
                const serverTypes = newConfig.mode !== 'bundler'
                                    ? { meteor: 'DDP Server', vite: 'App Server' }
                                    : { meteor: 'App Server', vite: 'HMR' };
                console.log();
                DevConnectionLog.info(
                    `[Meteor-Vite] %s\n${dataLine}\n${dataLine}`,
                    `Vite is ready for connections!\n`,
                    'Meteor Server', Meteor.absoluteUrl('/'), serverTypes.meteor,
                    'Vite Server', buildConnectionUri(newConfig), serverTypes.vite,
                );
                console.log();
            },
            refreshNeeded() {
                DevConnectionLog.info('Some lazy-loaded packages were imported, please refresh')
            }
        });
        
        viteServer.call({
            method: 'vite.startDevServer',
            params: [{
                packageJson: getProjectPackageJson(),
                meteorRuntimeConfig: this.runtime.config,
            }]
        });
        
        return viteServer;
    }
    
    /**
     * Register event listeners to transmit Meteor-specific events and metadata to the Vite server.
     * - The Meteor runtime config is necessary when Vite is used in place of Meteor's web app.
     * - IPC messages are used to track and notify our Vite build plugins when a client refresh needs to take place.
     * @protected
     */
    protected bindEventListeners() {
        /**
         * Send Meteor's runtime config down to
         */
        WebApp.addUpdatedNotifyHook((data) => {
            this.server?.call({
                method: 'meteor.setRuntimeConfig',
                params: [data.runtimeConfig],
            })
        })
        
        /**
         * Relay any IPC messages from the Meteor daemon to the Meteor-Vite worker to handle client refresh notices.
         */
        process.on('message', (message) => {
            if (!isMeteorIPCMessage(message)) return;
            this.server?.call({
                method: 'meteor.ipcMessage',
                params: [message],
            })
        })
    }
    
    
}

