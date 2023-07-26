import Path from 'path';
import FS from 'fs';
import type { ProjectJson } from '../../../npm-packages/meteor-vite/src/vite/plugin/MeteorStubs';
import { cwd } from '../workers';

interface Entry {
    type: 'server' | 'client';
    path: string; // meteor.mainModule.[client|server] path
}

export type EntryFiles = {
    server?: EntryFile,
    client: EntryFile,
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
        this.originalContent = this.removeOlderTemplates();
    }
    
    public static retrieve(packageJson: ProjectJson) {
        const { client, server } = packageJson.meteor.mainModule;
        
        if (!client) {
            throw new Meteor.Error('You need to specify a Meteor client mainModule in your package.json!');
        }
        
        return {
            client: new EntryFile({ type: 'client', path: client }),
            server: server ? new EntryFile({ type: 'server', path: server }) : undefined
        } satisfies EntryFiles;
    }
    
    /**
     * Patch the current file with an import string to assist the Meteor bundler with Vite-built modules.
     */
    public addImports(details: { imports: string[] }) {
        const importList = details.imports.map((importString) => {
            const resolved = Path.relative(
                Path.dirname(this.relativePath),
                importString,
            )
            return `./${resolved}`;
        })
        
        FS.writeFileSync(this.absolutePath, this.importTemplate({
            content: this.originalContent,
            importList,
        }), 'utf8');
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
    
    protected removeOlderTemplates() {
        const content = this.originalContent.replace(REGEX_AUTO_IMPORT_BLOCK, '');
        FS.writeFileSync(this.absolutePath, content);
        return content
    }
    
    protected importTemplate({ content, importList }: { content: string, importList: string[] }) {
        let { startBlock, imports, endBlock } = content.match(REGEX_AUTO_IMPORT_BLOCK)?.groups || { imports: '' };
        
        imports += importList.map((path) => `import '${path}';`).join('\n');
        imports = imports.trim();
        
        if (endBlock && startBlock) {
            return content.replace(REGEX_AUTO_IMPORT_BLOCK, `${startBlock.trim()}\n${imports}\n${endBlock.trim()}`);
        }
        // language=js
        return  `
/**
* [[BUILD-TIME IMPORTS]]
 * These imports are added by jorgenvatle:vite-bundler during a production build to force the Meteor bundler to accept
 * modules built by Vite.
 *
 * We don't have any good way of cleaning up these imports after a production build without interfering with the
 * module load-order and lazily loaded packages. If you have any suggestions on any hooks we can use to perform a
 * cleanup after Meteor has finished bundling for all target environments, please do open a PR or issue.
 *
 * {@link https://github.com/JorgenVatle/meteor-vite/issues}
 *
 * [THESE IMPORTS SHOULD BE REMOVED] - Do not commit them into version control.
 *-*/
 ${imports}
 /** End of vite-bundler production-imports **/
 ${content}`.trim()
    }
}

/**
 * Find the vite:bundler auto-import notice block to add more imports within it.
 *
 * {@link https://regex101.com/r/Twf7Md/1
 * @type {RegExp}
 */
const REGEX_AUTO_IMPORT_BLOCK = /(?<startBlock>[\s\r\n\w\W]+\*-\*\/[\r\n\s]+)(?<imports>(?:.*[\r\n])*)(?<endBlock>[\s\r\n]*\/\*\* End of vite[\-:]bundler production-imports \*\*\/)/
