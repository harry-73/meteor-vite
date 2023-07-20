import { BuildOutput, BuildPayload } from '../../../npm-packages/meteor-vite/src/bin/worker/build-for-production';
import Path from 'path';
// @ts-ignore
import FS from 'fs-extra';
import { getTempDir } from '../workers';
import EntryFile, { EntryFiles } from './EntryFile';
const tempDir = getTempDir();

export default class BuildPayloadProcessor {
    constructor(protected readonly payload: BuildPayload, protected readonly entryFiles: EntryFiles) {
        if (!payload.success) {
            throw new Error('Vite build failed')
        }
    }
    
    public copyToProject(details: { projectPath: string }) {
        const { client: clientOutput, server: serverOutput } = this.payload.outputs || {};
        
        if (!clientOutput) {
            throw new Error('Vite client build payload is empty!')
        }
        
        let server: ReturnType<typeof this.processOutput> | undefined;
        
        const client = this.processOutput({
            files: clientOutput,
            copyToPath: Path.join(details.projectPath, 'client', 'vite'),
            entryFile: this.entryFiles.client,
        })
        
        if (serverOutput?.length) {
            if (!this.entryFiles.server) {
                throw new Error('No entrypoint detected for Meteor server!');
            }
            server = this.processOutput({
                files: serverOutput,
                copyToPath: Path.join(details.projectPath, 'server', 'vite'),
                entryFile: this.entryFiles.server
            });
        }
        
        return { client, server };
    }
    
    protected processOutput({ copyToPath, files, entryFile }: { copyToPath: string, files: BuildOutput, entryFile: EntryFile }) {
        const entryAsset = files.find(file => file.fileName === 'meteor-entry.js' && file.type === 'chunk');
        
        if (!entryAsset) {
            throw new Error('No meteor-entry chunk found')
        }
        
        // Copy the assets to the Meteor auto-imported sources
        FS.ensureDirSync(copyToPath)
        FS.emptyDirSync(copyToPath)
        
        for (const file of files) {
            const from = file.absolutePath;
            const to = Path.join(copyToPath, file.fileName);
            
            FS.ensureDirSync(Path.dirname(to))
            
            if (Path.extname(from) === '.js') {
                // Transpile to Meteor target (Dynamic import support)
                // @TODO don't use Babel
                const source = FS.readFileSync(from, 'utf8')
                const babelOptions = Babel.getDefaultOptions()
                babelOptions.babelrc = true
                babelOptions.sourceMaps = true
                babelOptions.filename = babelOptions.sourceFileName = from
                const transpiled = Babel.compile(source, babelOptions, {
                    cacheDirectory: Path.join(tempDir, '.babel-cache'),
                })
                FS.writeFileSync(to, transpiled.code, 'utf8')
            } else {
                FS.copyFileSync(from, to)
            }
        }
        
        // Patch meteor entry
        entryFile.addImport({ relative: Path.join(copyToPath, entryAsset.fileName) });
        
        return {
            entryAsset,
            targetDir: copyToPath,
            files,
        };
    }
}

declare global {
    module Babel {
        type CompileOptions = {
            babelrc: boolean;
            sourceMaps: boolean;
            filename: string;
            sourceFileName: string;
        };
        function compile(source: string, compileOptions: CompileOptions, babelOptions: object): {
            code: string;
        }
        function getDefaultOptions(): CompileOptions;
    }
}