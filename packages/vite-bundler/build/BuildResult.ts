import type {
    BuildPayload,
    FormattedFileChunk,
} from '../../../npm-packages/meteor-vite/src/bin/worker/build-for-production';
import Path from 'path';
import FS from 'fs-extra';
import { getTempDir } from '../workers';
import { EntryFiles } from './EntryFile';
const tempDir = getTempDir();

export default class BuildResult {
    protected readonly payload: BuildPayload;
    protected readonly entryFile: EntryFiles;
    protected readonly tempAssetDir: { server?: string, client?: string } = {}
    
    constructor(build: { payload: BuildPayload, entryFile: EntryFiles }) {
        if (!build.payload.success) {
            throw new Error('Vite build failed')
        }
        
        this.payload = build.payload;
        this.entryFile = build.entryFile;
    }
    
    public copyToProject(details: { projectRoot: string }) {
        const client = this.processOutput({
            copyToPath: Path.join(details.projectRoot, 'client', 'vite'),
            target: 'client',
        });
        
        let server: ReturnType<typeof this.processOutput> | undefined;
        
        if (this.payload.outputs?.server?.length) {
            server = this.processOutput({
                copyToPath: Path.join(details.projectRoot, 'server', 'vite'),
                target: 'server',
            });
        }
        
        return [
            client.files,
            server?.files || [],
        ].flat();
    }
    
    public cleanupCopiedFiles() {
        const { server, client } = this.tempAssetDir;
        
        if (server) {
            FS.removeSync(server);
        }
        if (client) {
            FS.removeSync(client);
        }
        
        this.entryFile.client.cleanup();
        this.entryFile.server?.cleanup();
    }
    
    protected processOutput({ copyToPath, target }: { copyToPath: string, target: 'server' | 'client' }) {
        const entryFile = this.entryFile[target];
        const files = this.payload?.outputs?.[target];
        const entryAssets: FormattedFileChunk[] = [];
        
        if (!files) {
            throw new Error(`No build output emitted for Vite ${target} build!`);
        }
        
        if (!entryFile) {
            throw new Error(`Unable to resolve Meteor mainModule for ${target}! Did you remember to specify one in your package.json?`)
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
                
                // Patch meteor entry
                if (file.isEntry) {
                    entryFile.addImport({ relative: Path.join(copyToPath, file.fileName) });
                    entryAssets.push(file);
                }
                
            } else {
                FS.copyFileSync(from, to)
            }
        }
        
        this.tempAssetDir[target] = copyToPath;
        
        if (!entryAssets.length) {
            throw new Error(`No entry chunks found in Vite ${target} build result!`);
        }
        
        return {
            entryAssets,
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