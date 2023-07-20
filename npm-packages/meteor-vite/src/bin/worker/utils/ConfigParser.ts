import FS from 'fs/promises';
import OS from 'os';
import Path from 'path';
import { ProjectJson } from '../../../vite/plugin/MeteorStubs';

export async function getViteTempDir(packageJson: ProjectJson) {
    const path = packageJson?.meteor?.tempDir || Path.resolve(OS.tmpdir(), 'meteor-vite', packageJson.name, '.vite-server');
    await FS.mkdir(path, { recursive: true });
    
    return path;
}

export function resolveConfigFilePath(packageJson: ProjectJson) {
    if (!packageJson?.meteor?.viteConfig) {
        return undefined;
    }
    
    return Path.resolve(packageJson.meteor.viteConfig);
}