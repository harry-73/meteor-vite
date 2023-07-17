import { Meteor } from 'meteor/meteor'
import { WebAppInternals, WebApp } from 'meteor/webapp'
import type HTTP from 'http'
import FS from 'fs'
import Path from 'path';
import { MeteorClientProgram, MeteorRuntimeConfig } from '../../npm-packages/meteor-vite/src/meteor/InternalTypes';
import {
    getConfig, DevConnectionLog,
    MeteorViteConfig,
    setConfig,
    ViteConnection,
} from './loading/vite-connection-handler';
import { createWorkerFork, getProjectPackageJson, isMeteorIPCMessage, onTeardown, workerDir } from './workers';
let pid: string;
const clientProgram = WebApp.clientPrograms['web.browser'] as MeteorClientProgram;
const meteorRuntimeConfig: MeteorRuntimeConfig = JSON.parse(clientProgram.meteorRuntimeConfig);
let viteServer: ReturnType<typeof createWorkerFork>;

if (Meteor.isDevelopment) {
    DevConnectionLog.info('Starting Vite server...');
    
    WebAppInternals.registerBoilerplateDataCallback('meteor-vite', (request: HTTP.IncomingMessage, data: BoilerplateData) => {
        const { host, port, entryFile, ready } = getConfig();
        if (ready) {
            data.dynamicBody = `${data.dynamicBody || ""}\n<script type="module" src="http://${host}:${port}/${entryFile}"></script>\n`
        } else {
            // Vite not ready yet
            // Refresh page after some time
            data.dynamicBody = `${data.dynamicBody || ""}\n${Assets.getText('loading/dev-server-splash.html')}`
        }
    });
    
    WebApp.connectHandlers.use('/__meteor_runtime_config.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.writeHead(200);
        
        const meteorRuntimeConfig: MeteorRuntimeConfig = JSON.parse(WebApp.clientPrograms['web.browser'].meteorRuntimeConfig);
        const config = Object.assign({}, { DDP_DEFAULT_CONNECTION_URL: meteorRuntimeConfig.ROOT_URL }, meteorRuntimeConfig);
        
        res.end(`__meteor_runtime_config__ = JSON.parse(decodeURIComponent(${WebApp.encodeRuntimeConfig(config)}));`);
    })
    
    viteServer = createViteServer();
    
    process.on('message', (message) => {
        if (!isMeteorIPCMessage(message)) return;
        viteServer.call({
            method: 'meteor.ipcMessage',
            params: [message],
        })
    })
    
    Meteor.publish(ViteConnection.publication, () => {
        return MeteorViteConfig.find(ViteConnection.configSelector);
    });
    
    Meteor.methods({
        [ViteConnection.methods.refreshConfig]() {
            DevConnectionLog.info('Refreshing configuration from Vite dev server...')
            viteServer.call({
                method: 'vite.getDevServerConfig',
                params: [],
            });
            return getConfig();
        }
    })
    
    /**
     * Builds the 'meteor-vite' npm package where the worker and Vite server is kept.
     * Primarily to ease the testing process for the Vite plugin.
     */
    if (process.env.BUILD_METEOR_VITE_DEPENDENCY === 'true') {
        createMeteorViteBundleWatcher();
    }
}

function createViteServer() {
    const viteServer = createWorkerFork({
        viteConfig(config) {
            const { ready } = setConfig(config);
            if (ready) {
                DevConnectionLog.info(`Meteor-Vite ready for connections!`)
            }
        },
        refreshNeeded() {
            DevConnectionLog.info('Some lazy-loaded packages were imported, please refresh')
        }
    });
    
    viteServer.call({
        method: 'vite.startDevServer',
        params: [{
            packageJson: getProjectPackageJson(),
            meteorRuntimeConfig,
        }]
    });
    
    return viteServer;
}

function createMeteorViteBundleWatcher() {
    const packageBuilder = createWorkerFork({});
    let restartTimeout: ReturnType<typeof setTimeout>;
    let lastRestart = Date.now();
    packageBuilder.call({
        method: 'tsup.watchMeteorVite',
        params: [],
    });
    
    const recreateViteServer = Meteor.bindEnvironment(function(event: FS.WatchEventType) {
        if (!pid) {
            pid = (Math.random() * 1000).toFixed(2)
        }
        
        console.log(`pid: ${pid} Filesystem event from worker: ${event}`);
        console.log('Restarting worker...');
        viteServer.child.kill();
        viteServer = createViteServer();
    });
    
    const watcher = FS.watch(Path.join(workerDir, 'dist'), (event) => {
        clearTimeout(restartTimeout);
        if (Date.now() - lastRestart < 5_000) {
            return console.log('Server just started. Skipping restart to avoid immediate restart');
        }
        restartTimeout = setTimeout(() => recreateViteServer(event), 1000);
    });
    
    onTeardown(() => {
        watcher.close();
        console.log('Removed meteor-vite bundle watcher');
    })
}

interface BoilerplateData {
    dynamicBody?: string;
    additionalStaticJs: [contents: string, pathname: string][];
    inline?: string;
}