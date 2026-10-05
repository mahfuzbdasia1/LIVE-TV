import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'
const env = { ...process.env }

const api = spawn(process.execPath, ['--env-file=.env', 'server/dev.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env,
  windowsHide: true,
})

const viteCommand = isWin
  ? ['cmd.exe', ['/d', '/s', '/c', 'npm run dev:vite -- --host 0.0.0.0']]
  : ['npm', ['run', 'dev:vite', '--', '--host', '0.0.0.0']]

const vite = spawn(viteCommand[0], viteCommand[1], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env,
  windowsHide: true,
})

function shutdown() {
  api.kill()
  vite.kill()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
