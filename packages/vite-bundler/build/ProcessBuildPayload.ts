import { BuildOutput, BuildPayload } from '../../../npm-packages/meteor-vite/src/bin/worker/build-for-production';
import Path from 'path';
// @ts-ignore
import FS from 'fs-extra';
import { getTempDir } from '../workers';
import EntryFile, { EntryFiles } from './EntryFile';
const tempDir = getTempDir();

export function CopyFilesToMeteor({ payload, entryFiles, meteorPath }: {
    payload: BuildPayload,
    meteorPath: string,
    entryFiles: EntryFiles,
}) {
    if (!payload.outputs?.client) {
        throw new Error('Vite client build payload is empty!')
    }
    let server: ReturnType<typeof processOutput> | undefined;
    
    const client = processOutput({
        files: payload.outputs.client,
        copyToPath: Path.join(meteorPath, 'client', 'vite'),
        entryFile: entryFiles.client,
    })
    
    if (payload.outputs.server?.length) {
        if (!entryFiles.server) {
            throw new Error('No entrypoint detected for Meteor server!');
        }
        server = processOutput({
            files: payload.outputs.server,
            copyToPath: Path.join(meteorPath, 'server', 'vite'),
            entryFile: entryFiles.server
        });
    }
    
    return { client, server };
}

function processOutput({ copyToPath, files, entryFile }: { copyToPath: string, files: BuildOutput, entryFile: EntryFile }) {
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