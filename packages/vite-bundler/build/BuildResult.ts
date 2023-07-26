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
    public readonly payload: BuildPayload;
    protected readonly entryFile: EntryFiles;
    protected readonly projectRoot: string;
    protected readonly tempAssetDir: string;
    
    constructor(build: {
        payload: BuildPayload,
        entryFile: EntryFiles,
        /**
         * Absolute path to the user's Meteor project that is being bundled.
         * This would normally be the current working directory.
         */
        projectRoot: string
    }) {
        if (!build.payload.success) {
            throw new Error('Vite build failed')
        }
        
        this.projectRoot = build.projectRoot;
        this.payload = build.payload;
        this.entryFile = build.entryFile;
        this.tempAssetDir = Path.join(this.projectRoot, 'vite');
    }
    
    public copyToProject() {
        console.log(pc.blue(`⚡️ Appending Vite entry-points to Meteor entries`));
        
        const client = this.processOutput({ buildTarget: 'client' });
        
        let server: ReturnType<typeof this.processOutput> | undefined;
        
        if (this.payload.outputs?.server?.length) {
            server = this.processOutput({ buildTarget: 'server', });
        }
        
        
        return {
            assetFileNames: new Set([
                ...client.assets,
                ...server?.assets || [],
            ])
        };
    }
    
    public cleanupCopiedFiles() {
        FS.removeSync(this.tempAssetDir);
        
        this.entryFile.client.cleanup();
        this.entryFile.server?.cleanup();
    }
    
    protected processOutput({ buildTarget }: {  buildTarget: 'server' | 'client' }) {
        const entryFile = this.entryFile[buildTarget];
        const files = this.payload?.outputs?.[buildTarget];
        const targetDirname = `vite-${buildTarget}`;
        const assets = new Set();
        const entryAssets: FormattedFileChunk[] = [];
        
        if (!files) {
            throw new Error(`No build output emitted for Vite ${buildTarget} build!`);
        }
        
        if (!entryFile) {
            throw new Error(`Unable to resolve Meteor mainModule for ${buildTarget}! Did you remember to specify one in your package.json?`)
        }
        
        
        // Copy the assets to the Meteor auto-imported sources
        FS.ensureDirSync(Path.join(this.tempAssetDir, targetDirname))
        FS.emptyDirSync(Path.join(this.tempAssetDir, targetDirname))
        
        for (const file of files) {
            file.fileName = `${targetDirname}/${file.fileName}`;
            const from = file.absolutePath;
            const to = Path.join(this.tempAssetDir, file.fileName);
            
            FS.ensureDirSync(Path.dirname(to))
            assets.add(file.fileName);
            
            if (['.js', '.mjs', '.cjs'].includes(Path.extname(from))) {
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
                
                if (file.isEntry) {
                    entryAssets.push(file);
                }
                
            } else {
                FS.copyFileSync(from, to)
            }
        }
        
        if (!entryAssets.length) {
            throw new Error(`No entry chunks found in Vite ${buildTarget} build result!`);
        }
        
        // Patch meteor entry
        entryFile.addImports({
            imports: entryAssets.map((asset) => Path.join(this.tempAssetDir, asset.fileName))
        });
        
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
            assets,
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