#!/usr/bin/env node
/*
 Simple Allure helper for this monorepo.
 Usage:
  - Generate: node scripts/allure.js gen --user <name>
    or: npm run allure:gen -- <name>
  - Open:     node scripts/allure.js open --user <name>
    or: npm run allure:open -- <name>
*/
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const out = { cmd: '', user: '', base: 'apps/api/workspace/users' }
  const args = argv.slice(2)
  if (!args.length) return out
  out.cmd = args[0]
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    if (a === '--user' || a === '-u') {
      out.user = args[i + 1] || ''
      i++
    } else if (a === '--base') {
      out.base = args[i + 1] || out.base
      i++
    } else if (!a.startsWith('-') && !out.user) {
      out.user = a
    }
  }
  return out
}

function resolvePaths(user, base) {
  if (!user) throw new Error('Missing user. Provide with --user <name> or positional argument')
  const root = process.cwd()
  const userRoot = path.resolve(root, base, user)
  const resultsDir = path.join(userRoot, 'allure-results')
  const outDir = path.join(userRoot, 'allure-report')
  return { userRoot, resultsDir, outDir }
}

function which(cmd) {
  const test = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'pipe' })
  return test.status === 0
}

function findAllure() {
  // Prefer local bin
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'allure.cmd' : 'allure')
  if (fs.existsSync(local)) return { cmd: local, args: [] }
  // Global
  if (which('allure')) return { cmd: 'allure', args: [] }
  // npx (local only, no install)
  const npxCheck = spawnSync('npx', ['--no-install', 'allure', '--version'], { stdio: 'ignore' })
  if (npxCheck.status === 0) return { cmd: 'npx', args: ['--no-install', 'allure'] }
  return null
}

function ensureResults(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`allure-results not found: ${path.relative(process.cwd(), dir)}\nRun tests first to produce results.`)
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (res.error) throw res.error
  if (res.status !== 0) process.exit(res.status || 1)
}

function printHelp() {
  console.log(`Usage:
  Generate: npm run allure:gen -- <user>
  Open:     npm run allure:open -- <user>

Options:
  --user, -u   User directory under apps/api/workspace/users
  --base       Override base dir (default: apps/api/workspace/users)
`)
}

async function main() {
  const { cmd, user, base } = parseArgs(process.argv)
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp()
    return
  }
  const allure = findAllure()
  if (!allure) {
    console.error('[Allure CLI not found] Please install one of the following:')
    console.error('  - brew install allure (macOS)')
    console.error('  - npm i -D allure-commandline')
    process.exit(1)
  }
  const { resultsDir, outDir } = resolvePaths(user, base)
  if (cmd === 'gen' || cmd === 'generate') {
    ensureResults(resultsDir)
    console.log(`[Allure] Generating report from ${resultsDir} -> ${outDir}`)
    run(allure.cmd, [...allure.args, 'generate', '--clean', resultsDir, '-o', outDir])
  } else if (cmd === 'open') {
    // If report dir missing, try generate first
    if (!fs.existsSync(outDir)) {
      ensureResults(resultsDir)
      console.log(`[Allure] Report not found, generating...`)
      run(allure.cmd, [...allure.args, 'generate', '--clean', resultsDir, '-o', outDir])
    }
    console.log(`[Allure] Opening ${outDir}`)
    run(allure.cmd, [...allure.args, 'open', outDir])
  } else if (cmd === 'clean') {
    if (fs.existsSync(outDir)) {
      console.log(`[Allure] Removing ${outDir}`)
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  } else {
    printHelp()
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})

