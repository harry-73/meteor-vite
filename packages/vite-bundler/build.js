import path from 'node:path'
import { performance } from 'node:perf_hooks'
import fs from 'fs-extra'
import { execaSync } from 'execa'
import pc from 'picocolors'
import { createWorkerFork, cwd, getProjectPackageJson, getTempDir } from './workers';
import EntryFile from './build/EntryFile';
import BuildResult from './build/BuildResult';

if (process.env.NODE_ENV !== 'production') return

// Not in a project (publishing the package)
if (process.env.VITE_METEOR_DISABLED) return

const pkg = getProjectPackageJson();
const entryFile = EntryFile.retrieve(pkg);

// Meteor packages to omit or replace the temporary build.
// Useful for other build-time packages that may conflict with Meteor-Vite's temporary build.
const replaceMeteorPackages = [
  { startsWith: 'standard-minifier', replaceWith: '' },
  { startsWith: 'refapp:meteor-typescript', replaceWith: 'typescript' },
  ...pkg?.meteorVite?.replacePackages || []
]

const tempDir = getTempDir();
const tempMeteorProject = path.resolve(tempDir, 'input', 'meteor')
const tempMeteorOutDir = path.join(tempDir, 'output', 'meteor')
const viteOutDir = path.join(tempDir, 'output', 'vite');

// Temporary Meteor build

const filesToCopy = [
  path.join('.meteor', '.finished-upgraders'),
  path.join('.meteor', '.id'),
  path.join('.meteor', 'packages'),
  path.join('.meteor', 'platforms'),
  path.join('.meteor', 'release'),
  path.join('.meteor', 'versions'),
  'package.json',
  entryFile.client.relativePath,
]

const optionalFiles = [
    'tsconfig.json'
]

try {
  // Temporary Meteor build

  console.log(pc.blue('⚡️ Building packages to make them available to export analyzer...'))
  let startTime = performance.now()

  // Check for project files that may be important if available
  for (const file of optionalFiles) {
    if (fs.existsSync(path.join(cwd, file))) {
      filesToCopy.push(file);
    }
  }

  // Copy files from `.meteor`
  for (const file of filesToCopy) {
    const from = path.join(cwd, file)
    const to = path.join(tempMeteorProject, file)
    fs.ensureDirSync(path.dirname(to))
    fs.copyFileSync(from, to)
  }

  // Symblink to `packages` folder
  if (fs.existsSync(path.join(cwd, 'packages')) && !fs.existsSync(path.join(tempMeteorProject, 'packages'))) {
    fs.symlinkSync(path.join(cwd, 'packages'), path.join(tempMeteorProject, 'packages'))
  }
  // Remove/replace conflicting Atmosphere packages
  {
    const file = path.join(tempMeteorProject, '.meteor', 'packages')
    let content = fs.readFileSync(file, 'utf8')
    for (const pack of replaceMeteorPackages) {
      const lines = content.split('\n')
      content = lines.map(line => {
        if (!line.startsWith(pack.startsWith)) {
          return line;
        }
        return pack.replaceWith || '';
      }).join('\n')
    }
    fs.writeFileSync(file, content)
  }
  // Remove server entry
  {
    const file = path.join(tempMeteorProject, 'package.json')
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    data.meteor = {
      mainModule: {
        client: data.meteor.mainModule.client,
      },
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }
  // Only keep meteor package imports to enable lazy packages
  {
    const file = path.join(tempMeteorProject, entryFile.client.relativePath)
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const imports = lines.filter(line => line.startsWith('import') && line.includes('meteor/'))
    fs.writeFileSync(file, imports.join('\n'))
  }
  execaSync('meteor', [
    'build',
    tempMeteorOutDir,
    '--directory',
  ], {
    cwd: tempMeteorProject,
    // stdio: ['inherit', 'inherit', 'inherit'],
    env: {
      FORCE_COLOR: '3',
      VITE_METEOR_DISABLED: 'true',
    },
  })
  let endTime = performance.now()

  console.log(pc.green(`⚡️ Packages built (${Math.round((endTime - startTime) * 100) / 100}ms)`))

  // Vite

  console.log(pc.blue('⚡️ Building with Vite...'))
  startTime = performance.now()

  fs.ensureDirSync(path.dirname(viteOutDir))

  // Build with vite
  const buildResult = Promise.await(new Promise((resolve, reject) => {
    const worker = createWorkerFork({
      buildResult: (result) => {

        const buildResult = new BuildResult({
          payload: result.payload,
          entryFile,
        })

        resolve(buildResult);
      },
    });

    worker.call({
      method: 'buildForProduction',
      params: [{
        viteOutDir,
        packageJson: pkg,
        meteor: {
          packagePath: path.join(tempMeteorOutDir, 'bundle', 'programs', 'web.browser', 'packages'),
          isopackPath: path.join(tempMeteorProject, '.meteor', 'local', 'isopacks'),
        },
      }],
    })
  }))

  endTime = performance.now()
  console.log(pc.green(`⚡️ Build successful (${Math.round((endTime - startTime) * 100) / 100}ms)`))

  const assets = buildResult.copyToProject({
    projectRoot: cwd
  });


  class Compiler {
    processFilesForTarget (files) {
      files.forEach(file => {
        switch (path.extname(file.getBasename())) {
          case '.js':
            file.addJavaScript({
              path: file.getPathInPackage(),
              data: file.getContentsAsString(),
            })
            break
          case '.css':
            file.addStylesheet({
              path: file.getPathInPackage(),
              data: file.getContentsAsString(),
            })
            break
          default:
            file.addAsset({
              path: file.getPathInPackage(),
              data: file.getContentsAsBuffer(),
            })
        }
      })
    }

    afterLink () {
      buildResult.cleanupCopiedFiles()
    }
  }

  Plugin.registerCompiler({
    extensions: [],
    filenames: assets.map((file) => file.fileName),
  }, () => new Compiler())
} catch (e) {
  throw e
} finally {
  console.log(pc.blue('⚡️ Cleaning up temporary files...'))
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(pc.green('⚡️ Cleanup completed'))
}