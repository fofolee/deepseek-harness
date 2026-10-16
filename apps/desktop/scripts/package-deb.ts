/**
 * Package a Linux .deb distribution artifact.
 *
 * Runs full desktop build and electron-builder deb packaging for Linux (x64 or arm64).
 */

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { desktopArtifactOutput, desktopTargetBuildPaths } from './desktop-build-paths.mjs'
import { localLinuxPackageEnvironment } from './desktop-package-environment.mjs'
import { createPackagingRun } from './packaging-run.mjs'
import { packageTarget, resolveDesktopPackageTarget } from './package-target.ts'

const APP_ROOT = resolve(import.meta.dirname, '..')

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2).filter(arg => arg !== '--'),
    allowPositionals: true,
    options: {
      arch: { type: 'string' },
      dir: { type: 'boolean', default: false },
    },
  })

  const arch = values.arch ?? (positionals[0]?.includes('arm64') ? 'arm64' : process.arch === 'arm64' ? 'arm64' : 'x64')
  const targetName = `linux-${arch}` as const
  const target = resolveDesktopPackageTarget(targetName, 'linux', arch)
  const environment = localLinuxPackageEnvironment(process.env)

  const paths = desktopTargetBuildPaths(target.name)
  const invocation = {
    target,
    directory: values.dir,
    prepareOnly: false,
    unsigned: true,
    skipNotarization: false,
    check: false,
    requestedBuildVersion: undefined,
  }

  const run = createPackagingRun(join(APP_ROOT, '.desktop-build', 'packaging-runs'), {
    target: target.name,
    unsigned: true,
    skipNotarization: false,
    directory: values.dir,
    prepareOnly: false,
    version: '0.0.0',
    productVersion: '0.0.0',
    node: process.version,
    commit: '',
    dirty: false,
  }, { parallel: false, secrets: [] })

  try {
    await packageTarget(invocation, environment, run)
    const artifactsDir = desktopArtifactOutput(paths, invocation).directory
    if (existsSync(artifactsDir)) {
      const debs = readdirSync(artifactsDir).filter(f => f.endsWith('.deb'))
      for (const deb of debs) {
        console.log(`DEB: ${join(artifactsDir, deb)}`)
      }
    }
  } finally {
    run.finish(true)
  }
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
