import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const daemonDir = path.resolve(here, '../../daemon')
const daemonAddr = process.env.MITOM_ADDR ?? '127.0.0.1:7420'
const daemonUrl = `http://${daemonAddr}`

async function daemonHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${daemonUrl}/api/health`, { signal: AbortSignal.timeout(800) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Builds and starts src/daemon alongside the dev server so the web client
 * always has its backend. Reuses an already running daemon on the same port.
 * Set MITOM_NO_DAEMON=1 to skip.
 */
function mitomDaemon(): Plugin {
  let proc: ChildProcess | null = null
  const stop = () => {
    if (proc && proc.exitCode === null) proc.kill('SIGTERM')
    proc = null
  }

  return {
    name: 'mitom-daemon',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.MITOM_NO_DAEMON || process.env.VITEST) return
      const log = server.config.logger
      if (await daemonHealthy()) {
        log.info(`[daemon] reusing daemon already running at ${daemonUrl}`)
        return
      }

      // Build a binary and run it directly: killing `go run` would orphan the child.
      const bin = path.join(daemonDir, 'bin', process.platform === 'win32' ? 'mitom-daemon.exe' : 'mitom-daemon')
      log.info('[daemon] building src/daemon ...')
      const build = spawnSync('go', ['build', '-o', bin, '.'], { cwd: daemonDir, stdio: 'inherit' })
      if (build.error || build.status !== 0) {
        log.error(`[daemon] build failed${build.error ? `: ${build.error.message}` : ''}. Is Go installed?`)
        return
      }

      proc = spawn(bin, ['-addr', daemonAddr], { cwd: daemonDir, stdio: 'inherit', env: process.env })
      proc.on('exit', (code, signal) => {
        if (code !== 0 && signal !== 'SIGTERM') log.error(`[daemon] exited (code=${code}, signal=${signal})`)
      })
      server.httpServer?.once('close', stop)
      process.once('exit', stop)
      for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        process.once(sig, () => {
          stop()
          process.exit(0)
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), mitomDaemon()],
  server: {
    proxy: {
      '/api': { target: daemonUrl },
    },
  },
})
