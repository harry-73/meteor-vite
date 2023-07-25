import { MeteorArchitecture, MeteorRuntimeConfig } from '../../../npm-packages/meteor-vite/src/meteor/InternalTypes';
import { WebApp } from 'meteor/webapp';

export class MeteorViteRuntime {
    protected architecture: keyof typeof WebApp.clientPrograms;
    
    constructor({ architecture = 'web.browser' }) {
        this.architecture = architecture;
    }
    
    public static hasClientArchitecture(architecture: string): architecture is MeteorArchitecture {
        return architecture in WebApp.clientPrograms;
    }
    
    /**
     * Meteor's client runtime config formatted as JSON.
     * Here we add a few extra default values to help when rendering pages using Vite as a replacement for Meteor's
     * web server.
     * @return {MeteorRuntimeConfig}
     */
    public get config(): MeteorRuntimeConfig {
        const program = WebApp.clientPrograms[this.architecture] as typeof WebApp.clientPrograms[string] & {
            meteorRuntimeConfig: string
        };
        const config: MeteorRuntimeConfig = JSON.parse(program.meteorRuntimeConfig);
        return Object.assign({
            DDP_DEFAULT_CONNECTION_URL: config.DDP_DEFAULT_CONNECTION_URL || config.ROOT_URL,
            RUNTIME_CONFIG_SOURCE: 'meteor-vite',
        }, config);
    }
    
    /**
     * Template script for initializing Meteor's runtime config.
     * This globally assigned variable is needed when using any Meteor bundle either on the client or server.
     *
     * Meteor normally adds this as an inline script to all HTML served by Meteor. But when serving pages through
     * Vite, we need to inject this manually.
     * @return {string}
     */
    public initTemplate() {
        return `__meteor_runtime_config__ = JSON.parse(decodeURIComponent(${WebApp.encodeRuntimeConfig(this.config)}));`;
    }
}