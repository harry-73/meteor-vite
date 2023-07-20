import Path from 'path';
import FS from 'fs';
import { cwd } from '../workers';

export default class EntryFile {
    
    public readonly relativePath: string;
    public readonly absolutePath;
    public readonly type: 'server' | 'client';
    public originalContent?: string;
    
    /**
     * Path to the current project's entrypoint for either the server or client.
     */
    constructor(file: { type: EntryFile['type'], path: string }) {
        this.type = file.type;
        this.relativePath = Path.relative(cwd, file.path);
        this.absolutePath = Path.join(cwd, file.path);
    }
    
    /**
     * Patch the current file with an import string to assist the Meteor bundler with Vite-built modules.
     * @param {string} importPath
     */
    public addImport(importPath: string) {
        this.originalContent = FS.readFileSync(this.absolutePath, 'utf8');
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