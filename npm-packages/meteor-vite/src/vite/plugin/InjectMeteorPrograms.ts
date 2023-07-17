import FS from 'fs/promises';
import { HtmlTagDescriptor } from 'vite';
import { MeteorManifest, MeteorProgram } from '../../meteor/InternalTypes';
import { PluginSettings } from './MeteorStubs';
import { Plugin } from 'vite';
import Path from 'path';

export default function InjectMeteorPrograms(pluginSettings:  PluginSettings) {
    return {
        name: 'meteor-vite: inject Meteor Programs HTML',
        /**
         * When acting as the frontend server in place of Meteor, inject Meteor's package import scripts into the
         * server-rendered page.
         */
        async transformIndexHtml() {
            const path = Path.join(pluginSettings.meteor.packagePath, '../program.json');
            const program: MeteorProgram = JSON.parse(await FS.readFile(path, 'utf-8'));
            let imports: HtmlTagDescriptor[] = [];
            
            const assetUrl = (manifest: MeteorManifest) => {
                const base = pluginSettings.meteor.runtimeConfig.ROOT_URL.replace(/^\/*/, '');
                const path = manifest.url.replace(/^\/*/, '');
                return `${base}${path}`;
            }
            
            imports.push({ tag: 'script', attrs: { type: 'text/javascript', src: 'http://localhost:3000/__meteor_runtime_config.js' } })
            
            program.manifest.forEach((asset) => {
                if (asset.type === 'css') {
                    imports.push({ tag: 'link', injectTo: 'head', attrs: { href: assetUrl(asset), rel: 'stylesheet' } })
                }
                if (asset.type === 'js') {
                    imports.push({ tag: 'script', injectTo: 'head', attrs: { type: 'text/javascript', src: assetUrl(asset) } })
                }
            })
            
            return imports;
        },
    } satisfies Plugin;
}