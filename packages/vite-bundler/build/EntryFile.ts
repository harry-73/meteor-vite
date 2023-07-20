import Path from 'path';
import FS from 'fs';
import type { ProjectJson } from '../../../npm-packages/meteor-vite/src/vite/plugin/MeteorStubs';
import { cwd } from '../workers';

interface Entry {
    type: 'server' | 'client';
    path: string; // meteor.mainModule.[client|server] path
}

export default class EntryFile {
    
    public readonly relativePath: string;
    public readonly absolutePath: string;
    public readonly originalContent: string;
    public readonly type: Entry['type'];
    
    /**
     * Path to the current project's entrypoint for either the server or client.
     */
    constructor(entry: Entry) {
        if (!FS.existsSync(entry.path)) {
            throw new Meteor.Error(`Unable to locate Meteor ${entry.type} mainModule in ${entry.path}`);
        }
        
        this.type = entry.type;
        this.relativePath = Path.relative(cwd, entry.path);
        this.absolutePath = Path.join(cwd, entry.path);
        this.originalContent = FS.readFileSync(this.absolutePath, 'utf8');
    }
    
    public static retrieve(packageJson: ProjectJson) {
        const { client, server } = packageJson.meteor.mainModule;
        
        if (!client) {
            throw new Meteor.Error('You need to specify a Meteor client mainModule in your package.json!');
        }
        
        return {
            client: new EntryFile({ type: 'client', path: client }),
            server: server && new EntryFile({ type: 'server', path: server }),
        }
    }
    
    /**
     * Patch the current file with an import string to assist the Meteor bundler with Vite-built modules.
     * @param {string} importPath
     */
    public addImport(importPath: string) {
        FS.writeFileSync(
            this.absolutePath,
            `import ${JSON.stringify(importPath)}\n${this.originalContent}`,
            'utf8'
        );
    }
    
    /**
     * Revert entrypoint back to the state it was before we modified it.
     */
    public cleanup() {
        if (!this.originalContent) {
            throw new Error(`Unable to restore entrypoint to it's original state`);
        }
        
        FS.writeFileSync(this.absolutePath, this.originalContent, 'utf-8')
    }
}