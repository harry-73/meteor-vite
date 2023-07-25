import FS from 'fs';
import Path from 'path';
import { createWorkerFork, onTeardown, workerDir } from '../workers';
import ViteDevServer from './vite-dev-server';

export default class WatchLocalDependencies {
    protected pid: string;
    protected readonly server: ViteDevServer;
    protected lastRestart = Date.now();
    protected restartCountdown?: ReturnType<typeof setTimeout>;
    protected worker: ReturnType<typeof createWorkerFork>;
    protected watcher?: FS.FSWatcher;
    
    constructor(options: { viteServer: ViteDevServer }) {
        this.server = options.viteServer;
        this.pid = (Math.random() * 1000).toFixed(2);
        this.worker = createWorkerFork({})
    }
    
    protected restartServer() {
        console.log(`pid: ${this.pid} Filesystem event from worker: ${event}`);
        console.log('Restarting dev server worker...');
        this.server.stop();
        this.server.start();
    }
    
    protected get msSinceLastRestart() {
        return Date.now() - this.lastRestart;
    }
    
    public start() {
        if (this.watcher) {
            console.error(new Error('Meteor tried to create more than one dependency watcher!'))
        }
        
        this.worker.call({
            method: 'tsup.watchMeteorVite',
            params: [],
        });
        
        this.watcher = FS.watch(Path.join(workerDir, 'dist'), (event) => {
            clearTimeout(this.restartCountdown);
            
            if (this.msSinceLastRestart < 5_000) {
                return console.log('Server just started. Skipping restart to avoid immediate restart');
            }
            
            this.restartCountdown = setTimeout(() => this.restartServer(), 1000);
        });
        
        onTeardown(() => this.stop());
    }
    
    public stop() {
        this.watcher?.close();
        delete this.watcher;
        console.log('Removed meteor-vite bundle watcher');
    }
    
}