import { MeteorViteMode, StubValidationSettings } from '../../vite/MeteorViteConfig';
import { StubValidatorOptions } from '../client/ValidateStub';
import MeteorPackage from './components/MeteorPackage';

export const METEOR_STUB_KEY = `m2`;
export const PACKAGE_SCOPE_KEY = 'm';
export const TEMPLATE_GLOBAL_KEY = 'g';

/**
 * Creates a stub for the provided Meteor package and requested submodule.
 * Used to bridge imports for Meteor code that Vite doesn't have access to, to the below template that acts as a
 * proxy between Vite and Meteor's modules.
 */
export function stubTemplate({ requestId, meteorPackage, importPath, viteMode, stubValidation: validationSettings }: {
    requestId: string;
    stubValidation?: StubValidationSettings,
    viteMode: MeteorViteMode;
    meteorPackage: MeteorPackage;
    importPath?: string;
}) {
    const stubId = getStubId();
    const { packageId } = meteorPackage;
    const submodule = meteorPackage.getModule({ importPath });
    const serializedPackage = meteorPackage.serialize({ importPath });
    const fullImportPath = submodule?.fullImportPath || packageId;
    
    const stubValidation = stubValidationTemplate({
        packageId,
        requestId,
        settings: validationSettings,
        exportKeys: serializedPackage.exportKeys,
    });
    
    /**
     * Explicitly include Meteor's client bundle in the build when Vite is being used as the user-facing part of the
     * Meteor app.
     * {@link MeteorViteMode}
     */
    if (['ssr', 'frontend'].includes(viteMode)) {
        serializedPackage.imports.push(`import 'virtual:meteor-bundle';`);
    }
    
    // language="js"
    return`
// requestId: ${requestId}
// packageId: ${packageId}
// source path: ${meteorPackage.sourcePath}

${stubValidation.importString}
const ${TEMPLATE_GLOBAL_KEY} = typeof window !== 'undefined' ? window : global;
${serializedPackage.imports.join('\n')}
${serializedPackage.reExports.join('\n')}

let ${METEOR_STUB_KEY};
const require = Package.modules.meteorInstall({
  '__vite_stub${stubId}.js': (require, exports, module) => {
      ${METEOR_STUB_KEY} = require('${fullImportPath}');
      
      ${stubValidation.validateStub}
  }
}, {
  "extensions": [
    ".js"
  ]
})
require('/__vite_stub${stubId}.js')

${serializedPackage.exports.join('\n')}
`
}

/**
 * Find the vite:bundler auto-import notice block to add more imports within it.
 *
 * {@link https://regex101.com/r/shKDPE/1}
 * @type {RegExp}
 */
const REGEX_AUTO_IMPORT_BLOCK = /(?<startBlock>\*\*\/[\r\n\s]+)(?<imports>(?:.*[\r\n])*)(?<endBlock>[\s\r\n]*\/\*\* End of vite[\-:]bundler auto-imports \*\*\/)/

export function viteAutoImportBlock({ content, id }: { content: string, id: string }) {
    let { startBlock, imports, endBlock } = content.match(REGEX_AUTO_IMPORT_BLOCK)?.groups || { imports: '' };
    
    imports += `import '${id}';\n`;
    imports = imports.trim();
    
    if (endBlock && startBlock) {
        return content.replace(REGEX_AUTO_IMPORT_BLOCK, `${startBlock.trim()}\n${imports}\n${endBlock.trim()}`);
    }
    
    return `/**
 * These modules are automatically imported by jorgenvatle:vite-bundler.
 * You can commit these to your project or move them elsewhere if you'd like,
 * but they must be imported somewhere in your Meteor entrypoint file.
 *
 * More info: https://github.com/JorgenVatle/meteor-vite#lazy-loaded-meteor-packages
**/
${imports}
/** End of vite-bundler auto-imports **/

${content}`;
}

function stubValidationTemplate({ settings, requestId, exportKeys, packageId }: {
    settings?: StubValidationSettings,
    requestId: string;
    exportKeys: string[];
    packageId: string;
}) {
    if (settings?.disabled) {
        return {
            importString: '',
            validateStub: '',
        };
    }
    
    if (settings?.ignorePackages?.includes(packageId)) {
        return {
            importString: '',
            // language=js
            validateStub: `console.debug("Stub validation disabled for '${packageId}'");`,
        }
    }
    
    const validatorOptions: StubValidatorOptions = {
        requestId,
        packageName: packageId,
        exportKeys: exportKeys,
        warnOnly: settings?.warnOnly || true,
    }
    
    // language=js
    const importString = `import { validateStub } from 'meteor-vite/client';`
    // language=js
    const validateStub = `validateStub(${METEOR_STUB_KEY}, ${JSON.stringify(validatorOptions)});`;
    
    return {
        importString,
        validateStub,
    }
}

/**
 * Unique ID for the next stub.
 * @type {number}
 */
let nextStubId = 0;
function getStubId() {
    return nextStubId++;
}
