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
    };
}

/**
 * Specifies how you want to use Vite with Meteor.
 *
 * hmr = Vite is used for bundling your client assets for production and as a HMR server in development
 *
 * ssr = Vite is used as a replacement for Meteor's webapp. This assumes you have Vite configured to handle
 * server-side rendering. In this mode, Meteor is only used as a DDP server and for serving its package bundles.
 *
 * @default hmr
 */
export type MeteorViteMode =
    | 'hmr' // Using Vite for blazing fast Hot Module Replacement (Users should connect to the Meteor URL)
    | 'ssr' // Using Vite as a Server-Side Renderer (Users should access their app from the Vite connection URL)

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