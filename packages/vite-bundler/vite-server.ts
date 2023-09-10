import type HTTP from 'http';
import { Meteor } from 'meteor/meteor';
import { WebApp, WebAppInternals } from 'meteor/webapp';
import {
    MeteorManifest,
    MeteorRuntimeConfig,
} from '../../npm-packages/meteor-vite/src/meteor/InternalTypes';
import { getConfig, MeteorViteConfig, ViteConnection, RuntimeConfig } from './loading/vite-connection-handler';
import { MeteorViteRuntime } from './server/MeteorViteRuntime';
import ViteDevServer from './server/ViteDevServer';
import WatchLocalDependencies from './server/WatchLocalDependencies';

function viteHtml({ host, port, entryFile }: RuntimeConfig) {
    return `
<script id="vite-entrypoint" defer type="module" src="http://${host}:${port}/${entryFile}"></script>
<script>
document.getElementById('vite-entrypoint').onerror = (error) => {
    console.error('Vite entrypoint module failed to load! Refreshing page...', error);
    window.location.reload();
}
</script>
`
}

WebApp.connectHandlers.use('__meteor-vite/meteor/__meteor_runtime_config__.js', (req, res) => {
    const url = new URL(req.url || '');
    const architecture = url.searchParams.get('arc') || 'web.browser';
    
    if (!MeteorViteRuntime.hasClientArchitecture(architecture)) {
        res.writeHead(404);
        res.end('Unrecognized client archetecture');
        return;
    }
    
    const runtime = new MeteorViteRuntime({ architecture });
    res.setHeader('Content-Type', 'application/javascript')
    res.writeHead(200);
    res.end(runtime.initTemplate());
});

if (Meteor.isDevelopment) {
    const server = new ViteDevServer(
        new MeteorViteRuntime({ architecture: 'web.browser' })
    );
    
    WebAppInternals.registerBoilerplateDataCallback('meteor-vite', (request: HTTP.IncomingMessage, data: BoilerplateData) => {
        const config = getConfig();
        if (config.ready) {
            data.dynamicBody = `${data.dynamicBody || ""}\n${viteHtml(config)}\n`
        } else {
            // Vite not ready yet
            // Refresh page after some time
            data.dynamicBody = `${data.dynamicBody || ""}\n${Assets.getText('loading/dev-server-splash.html')}`
        }
    });
    
    Meteor.publish(ViteConnection.publication, () => {
        return MeteorViteConfig.find(ViteConnection.configSelector);
    });
    
    Meteor.methods({
        [ViteConnection.methods.refreshConfig]() {
            return server.refreshConfig();
        }
    });
    
    /**
     * Builds the 'meteor-vite' npm package where the worker and Vite server is kept.
     * Primarily to ease the testing process for the Vite plugin.
     */
    if (process.env.METEOR_VITE_TSUP_BUILD_WATCHER === 'true') {
        const watcher = new WatchLocalDependencies({ viteServer: server });
        Meteor.startup(() => watcher.start());
    }
    
    Meteor.startup(() => server.start());
}

interface BoilerplateData {
    dynamicBody?: string;
    additionalStaticJs: [contents: string, pathname: string][];
    inline?: string;
}

declare module 'meteor/webapp' {
    module WebApp {
        function encodeRuntimeConfig(config: object): string;
        function addUpdatedNotifyHook(hook: (config: { arc: string, manifest: MeteorManifest, runtimeConfig: MeteorRuntimeConfig }) => void): void;
    }
}