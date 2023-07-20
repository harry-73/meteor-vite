import type {
    BuildPayload,
    FormattedFileChunk,
} from '../../../npm-packages/meteor-vite/src/bin/worker/build-for-production';
import Path from 'path';
import FS from 'fs-extra';
import { getTempDir } from '../workers';
import { EntryFiles } from './EntryFile';
const tempDir = getTempDir();
import pc from 'picocolors';

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
        console.log(pc.blue(`⚡️ Appending Vite entry-points to Meteor entries`));
        
        const targetDirectory = Path.join(details.projectRoot, 'vite');
        
        const client = this.processOutput({ targetDirectory, buildTarget: 'client' });
        
        let server: ReturnType<typeof this.processOutput> | undefined;
        
        if (this.payload.outputs?.server?.length) {
            server = this.processOutput({ targetDirectory, buildTarget: 'server', });
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
    
    protected processOutput({ targetDirectory, buildTarget }: { targetDirectory: string, buildTarget: 'server' | 'client' }) {
        const entryFile = this.entryFile[buildTarget];
        const files = this.payload?.outputs?.[buildTarget];
        const entryAssets: FormattedFileChunk[] = [];
        
        if (!files) {
            throw new Error(`No build output emitted for Vite ${buildTarget} build!`);
        }
        
        if (!entryFile) {
            throw new Error(`Unable to resolve Meteor mainModule for ${buildTarget}! Did you remember to specify one in your package.json?`)
        }
        
        // Copy the assets to the Meteor auto-imported sources
        FS.ensureDirSync(targetDirectory)
        FS.emptyDirSync(targetDirectory)
        
        for (const file of files) {
            file.fileName = `${buildTarget}/${file.fileName}`;
            const from = file.absolutePath;
            const to = Path.join(targetDirectory, file.fileName);
            
            FS.ensureDirSync(Path.dirname(to))
            
            if (['.js', '.mjs'].includes(Path.extname(from))) {
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
                    entryFile.addImport({ relative: Path.join(targetDirectory, file.fileName) });
                    entryAssets.push(file);
                }
                
            } else {
                FS.copyFileSync(from, to)
            }
        }
        
        this.tempAssetDir[buildTarget] = targetDirectory;
        
        if (!entryAssets.length) {
            throw new Error(`No entry chunks found in Vite ${buildTarget} build result!`);
        }
        
        const columnWidth = 80;
        console.log(pc.bgCyan(`./${entryFile.relativePath}`));
        entryAssets.forEach((asset) => {
            const dirname = Path.dirname(asset.fileName);
            const filename = Path.basename(asset.fileName);
            const addSpaceCount = columnWidth - (dirname.length + filename.length)
            const whitespace = ' '.repeat(addSpaceCount > 1 ? addSpaceCount : 1)
            const targetId = buildTarget === 'client' ? pc.dim(buildTarget) : pc.yellow(buildTarget);
            console.log(`${pc.dim(`  L ./${dirname}/`)}${pc.cyan(filename)}${whitespace}${pc.dim('| ')}${targetId}`);
        });
        
        return {
            entryAssets,
            targetDir: targetDirectory,
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