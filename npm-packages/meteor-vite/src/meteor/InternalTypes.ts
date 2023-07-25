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
    autoupdate?: AutoUpdateRuntime;
}

type AutoUpdateRuntime = {
    versions?: {
        'web.browser.legacy'?: {
            versionNonRefreshable: string;
            version: string;
            versionHmr: number;
            versionRefreshable: string;
            versionReplaceable: string
        };
        'web.browser'?: {
            versionNonRefreshable: string;
            version: string;
            versionHmr: number;
            versionRefreshable: string;
            versionReplaceable: string
        }
    };
    autoupdateVersionCordova: null;
    appId: string;
    autoupdateVersion: null;
    autoupdateVersionRefreshable: null
};

export interface MeteorClientProgram {
    format: string;
    manifest: any;
    version: string;
    cordovaCompatibilityVersions?: any;
    PUBLIC_SETTINGS: any;
    meteorRuntimeConfig: string; // JSON parses to > MeteorRuntimeConfig
}

export type MeteorArchitecture = 'web.browser' | 'web.browser.legacy' | 'server' | string;