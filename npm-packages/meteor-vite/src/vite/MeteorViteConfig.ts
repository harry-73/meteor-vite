import { ResolvedConfig } from 'vite';

export declare interface MeteorViteConfig extends ResolvedConfig {
    meteor?: {
        /**
         * Vite client entry into Meteor.
         * Not to be confused with your Meteor mainModule.
         *
         * {@link https://github.com/JorgenVatle/meteor-vite#readme}
         */
        clientEntry?: string;
        
        /**
         * Vite entrypoint if building for SSR.
         */
        serverEntry?: string;
        
        /**
         * Settings for controlling how stubs created by Meteor-Vite are validated.
         * These settings only apply in a development environment. Once the app is bundled for production, runtime
         * stub validation is disabled.
         */
        stubValidation?: StubValidationSettings;
        
        /**
         * Use Vite as a Server-Side-Renderer (experimental) or as a bundler and Hot-Module-Replacement server
         * {@link MeteorViteMode}
         * @default hmr
         */
        viteMode?: MeteorViteMode;
        
        /**
         * Enabling debug mode will write all input and output files to a `.meteor-vite` directory.
         * Handy for quickly assessing how things are being formatted, or for writing up new test sources.
         * Intended for meteor-vite developers.
         */
        debug?: boolean;
    };
}

/**
 * Specifies how you want to use Vite with Meteor.
 *
 * bundler = Your frontend application is hosted by Meteor, but you're using Vite to bundle your app and provide blazing
 * fast Hot-Module-Replacement in development mode. (recommended)
 *
 * Experimental modes:
 *
 * frontend = Vite is responsible for bundling and hosting the user-facing part of your Meteor app. Vite will pull
 * in Meteor client bundles from Meteor and serve them to your clients as if Vite was the Meteor server. Meteor is
 * used as a DDP API server.
 *
 * ssr = Vite is used as a full replacement of your Meteor web app and will also simulate a Meteor client in order
 * to render your app on the server. This assumes you have Vite configured for SSR. (highly experimental)
 *
 * @default bundler
 */
export type MeteorViteMode =
    | 'bundler' // Using Vite for blazing fast Hot Module Replacement and bundling your app (Meteor hosts your app)
    | 'frontend' // Using Vite as a replacement for Meteor's frontend web app. (Vite hosts your app)
    | 'ssr' // Using Vite as a Server-Side Renderer (Vite hosts your app and acts as a Meteor client)

export interface StubValidationSettings {
    /**
     * list of packages to ignore export validation for.
     * @example
     * { ignorePackages: ['ostrio:cookies', 'test:ts-modules', ...] }
     */
    ignorePackages?: string[];
    
    /**
     * Will only emit warnings in the console instead of throwing an exception that may prevent the client app
     * from loading.
     * @default true
     */
    warnOnly?: boolean;
    
    /**
     * Whether to completely disable stub validation feature for Meteor-Vite.
     *
     * Tip:
     * You can use a conditional Vite configuration to enable/disable this for your production build
     * {@link https://vitejs.dev/config/#conditional-config}
     *
     * @default false
     */
    disabled?: boolean;
}