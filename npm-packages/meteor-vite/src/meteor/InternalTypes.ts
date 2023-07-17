export type MeteorProgram = {
    type: 'web-program-pre1'
    manifest: MeteorManifest[]
}

export type MeteorManifest = {
    path: string;
    where: 'client' | 'internal' | string;
    type: 'js' | 'css' | 'body' | 'head' | string;
    cacheable: boolean;
    url: string;
    size: number;
    hash: string;
    sri: string;
    replaceable: boolean;
    sourceMap: string;
    sourceMapUrl: string;
}

export type MeteorRuntimeConfig = {
    reactFastRefreshEnabled: boolean;
    isModern: boolean;
    gitCommitHash: string;
    ROOT_URL: string;
    meteorEnv: { NODE_ENV: string; TEST_METADATA: string };
    _hmrSecret: string;
    ROOT_URL_PATH_PREFIX: string;
    meteorRelease: string;
    PUBLIC_SETTINGS: { [key: string]: unknown }
    DDP_DEFAULT_CONNECTION_URL?: string;
}

export interface MeteorClientProgram {
    format: string;
    manifest: any;
    version: string;
    cordovaCompatibilityVersions?: any;
    PUBLIC_SETTINGS: any;
    meteorRuntimeConfig: string; // JSON parses to > MeteorRuntimeConfig
}