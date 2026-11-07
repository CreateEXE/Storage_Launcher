import { FileManagerService } from './fileManager';

export interface TermuxBridgeConfig {
  mode: 'virtual' | 'direct';
  endpoint: string; // e.g. "http://localhost:8080"
  authToken?: string;
  isConnected: boolean;
}

const CONFIG_KEY = 'termux_bridge_config_v1';

// Allowed roots for direct-mode working directories. Direct mode may only
// operate inside these trees; anything else (including ".." escapes) is
// rejected before it is sent to the daemon, and again by the daemon itself.
const ALLOWED_CWD_ROOTS = [
  '/storage/emulated/0',
  '/data/data/com.termux/files/home',
];

function normalizePosixPath(p: string): string {
  const parts = p.split('/').filter((seg) => seg !== '' && seg !== '.');
  const out: string[] = [];
  for (const seg of parts) {
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

function isAllowedCwd(cwd: string): boolean {
  if (!cwd || cwd.includes('\0')) return false;
  if (!cwd.startsWith('/')) return false;
  const normalized = normalizePosixPath(cwd);
  // Reject paths that tried to escape via ".." (normalisation changed them
  // in a way that no longer matches the original, or they left the root).
  if (cwd.split('/').includes('..') && normalized !== cwd.replace(/\/+$/, '')) {
    // Still allow a ".." that stays inside an allowed root, e.g.
    // /storage/emulated/0/Projects/../Projects/Chimera -> normalized is in-root.
    // The in-root check below is authoritative.
  }
  return ALLOWED_CWD_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(root + '/')
  );
}

function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

export class TermuxBridgeService {
  private static instance: TermuxBridgeService;
  private config: TermuxBridgeConfig = {
    mode: 'virtual',
    endpoint: 'http://localhost:8080',
    authToken: '',
    isConnected: false
  };
  private currentDir: string = '/storage/emulated/0/Projects/Chimera';

  private constructor() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch {
      // default
    }
  }

  public static getInstance(): TermuxBridgeService {
    if (!TermuxBridgeService.instance) {
      TermuxBridgeService.instance = new TermuxBridgeService();
    }
    return TermuxBridgeService.instance;
  }

  public getConfig(): TermuxBridgeConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<TermuxBridgeConfig>): void {
    // Never accept a non-loopback direct-mode endpoint: the daemon is a
    // localhost-only service, and pointing the app at a LAN / remote host
    // would send the auth token and shell commands to that host.
    if (newConfig.endpoint && !isLoopbackEndpoint(newConfig.endpoint)) {
      throw new Error(
        'Termux endpoint must be a loopback URL (http://localhost:8080 or http://127.0.0.1:8080)'
      );
    }
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
  }

  public getCurrentDir(): string {
    return this.currentDir;
  }

  public setCurrentDir(dir: string): void {
    if (!isAllowedCwd(dir)) {
      throw new Error(`Refusing to change to a directory outside the allowed roots: ${dir}`);
    }
    this.currentDir = normalizePosixPath(dir);
  }

  public async testConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
    if (!isLoopbackEndpoint(endpoint)) {
      return { success: false, message: 'Termux endpoint must be a loopback URL (localhost / 127.0.0.1).' };
    }
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(this.config.authToken ? { Authorization: `Bearer ${this.config.authToken}` } : {})
        }
      });
      if (res.ok) {
        this.setConfig({ endpoint, isConnected: true, mode: 'direct' });
        return { success: true, message: 'Connected to Termux daemon successfully.' };
      }
      if (res.status === 401) {
        return { success: false, message: 'Termux daemon rejected the auth token (401). Check the token in settings.' };
      }
      return { success: false, message: `Termux returned status ${res.status}. Check endpoint.` };
    } catch {
      return {
        success: false,
        message: 'Unable to reach Termux daemon. Ensure Termux background server is running or use Virtual Shell.'
      };
    }
  }

  public async executeCommand(command: string): Promise<string[]> {
    const trimmed = command.trim();
    if (!trimmed) return [];
    if (trimmed.includes('\0') || trimmed.length > 10000) {
      return ['[!] Refusing to run an invalid command (empty, NUL byte, or over 10,000 characters).'];
    }

    // If direct mode enabled and endpoint configured, try sending to Termux HTTP daemon
    if (this.config.mode === 'direct' && this.config.endpoint) {
      if (!isLoopbackEndpoint(this.config.endpoint)) {
        return ['[!] Direct Termux endpoint is not a loopback URL. Refusing to send the command.'];
      }
      if (!this.config.authToken) {
        return [
          '[!] Direct Termux mode requires an auth token. Set one in settings and restart the daemon with TERMUX_GUI_TOKEN set to the same value.'
        ];
      }
      if (!isAllowedCwd(this.currentDir)) {
        return [`[!] Refusing to run in ${this.currentDir}: outside the allowed roots.`];
      }
      try {
        const response = await fetch(`${this.config.endpoint.replace(/\/+$/, '')}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.authToken}`
          },
          body: JSON.stringify({ command: trimmed, cwd: this.currentDir })
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.output)) return data.output;
          return String(data.output || '').split('\n');
        }
        // Do NOT silently fall through to the virtual shell on a non-OK
        // direct-mode response: that would hide a daemon failure / auth
        // rejection and run a different (local, fake) command instead.
        if (response.status === 401) {
          return ['[!] Termux daemon rejected the auth token (401). Direct command was not run.'];
        }
        return [
          `[!] Termux daemon returned status ${response.status}. Direct command was not run and did not fall back to the virtual shell.`
        ];
      } catch {
        // Network failure: report it, do not silently run the virtual shell
        // as if the command had run on the device.
        return [
          `[!] Direct Termux connection unreachable at ${this.config.endpoint}. Command was not run.`
        ];
      }
    }

    return this.executeVirtual(trimmed);
  }

  private executeVirtual(command: string): string[] {
    const fs = FileManagerService.getInstance();
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case 'pwd':
        return [this.currentDir];

      case 'cd': {
        if (!args || args === '~') {
          this.currentDir = '/storage/emulated/0/Projects/Chimera';
          return [];
        }
        if (args === '..') {
          const parent = this.currentDir.substring(0, this.currentDir.lastIndexOf('/')) || '/';
          this.currentDir = parent;
          return [];
        }
        const next = args.startsWith('/')
          ? normalizePosixPath(args)
          : normalizePosixPath(`${this.currentDir.replace(/\/+$/, '')}/${args}`);
        if (!isAllowedCwd(next)) {
          return [`cd: ${args}: outside the allowed roots`];
        }
        this.currentDir = next;
        return [];
      }

      case 'ls': {
        const filesInDir = fs.getFilesByPath(this.currentDir);
        if (filesInDir.length === 0) return ['(empty directory)'];
        if (args.includes('-l') || args.includes('-la')) {
          const lines = [`total ${filesInDir.length * 4}`];
          filesInDir.forEach((f) => {
            const perm = f.isFolder ? 'drwxrwx--x' : '-rw-rw----';
            lines.push(`${perm} 1 u0_a328 u0_a328 ${f.size.padEnd(8)} ${f.modified} ${f.name}`);
          });
          return lines;
        }
        return [filesInDir.map((f) => (f.isFolder ? `${f.name}/` : f.name)).join('  ')];
      }

      case 'mkdir': {
        if (!args) return ['mkdir: missing operand'];
        fs.createFolder(this.currentDir, args);
        return [`[✓] Directory created: ${args}`];
      }

      case 'touch': {
        if (!args) return ['touch: missing file operand'];
        let type: any = 'Text';
        if (args.endsWith('.vrm')) type = 'VRM';
        else if (args.endsWith('.json')) type = 'JSON';
        else if (args.endsWith('.sh')) type = 'Shell Script';
        else if (args.endsWith('.cpp')) type = 'C++ Source';

        fs.createFile(this.currentDir, args, type, '// Created via Termux CLI');
        return [`[✓] File created: ${args}`];
      }

      case 'rm': {
        if (!args) return ['rm: missing operand'];
        const targetPath = `${this.currentDir.replace(/\/+$/, '')}/${args}`;
        const deleted = fs.deleteItem(targetPath);
        return [deleted ? `[✓] Removed ${args}` : `rm: cannot remove '${args}': No such file`];
      }

      case 'cat': {
        if (!args) return ['cat: missing filename'];
        const files = fs.getFilesByPath(this.currentDir);
        const match = files.find((f) => f.name === args);
        if (!match) return [`cat: ${args}: No such file or directory`];
        return (match.content || `[Binary data for ${args}]`).split('\n');
      }

      case 'echo': {
        if (args.includes('>')) {
          const [text, filename] = args.split('>').map((s) => s.trim());
          if (!filename) return ['echo: missing filename after >'];
          const cleanText = text.replace(/^["']|["']$/g, '');
          fs.createFile(this.currentDir, filename, 'Text', cleanText);
          return [`[✓] Written to ${filename}`];
        }
        return [args.replace(/^["']|["']$/g, '')];
      }

      case './run.sh':
        return [
          '[+] Executing Chimera Native Script...',
          '[*] Hardware: MediaTek Dimensity 6300 + Mali-G57 MC2 @ 120Hz',
          '[*] Loading VRM Runtime from /storage/emulated/0/Projects/Chimera/VRM_Models/Vessel.vrm',
          '[✓] 3D Engine running with Spring Bones active'
        ];

      case './build.sh':
        return [
          '-- Configuring Chimera Engine for arm64-v8a...',
          '-- Found OpenGLES 3.2 and Vulkan 1.3 headers',
          '-- Compiling src/main.cpp',
          '[100%] Built target chimera_bin'
        ];

      case 'neofetch':
        return [
          '       _             u0_a328@localhost',
          '      | |            -----------------',
          '  ____| |_ ___       OS: Android 16 (Motorola Moto G Power 2025)',
          ' / ___)  _) _ \\      Host: MediaTek Dimensity 6300 (8 cores)',
          '( (___| |_| |_| |     Kernel: Linux 6.1.75-android16',
          ' \\____)\\___\\___/      GPU: ARM Mali-G57 MC2 @ 120Hz Display',
          '                     Memory: 2480MiB / 8192MiB (8 GB LPDDR4X)'
        ];

      case 'help':
        return [
          'Termux GUI Integrated Shell Commands:',
          '  pwd, cd <dir>, ls [-la]     - File system navigation',
          '  mkdir <folder>              - Create directory (syncs to Explorer)',
          '  touch <filename>            - Create file (e.g. avatar.vrm, run.sh)',
          '  rm <filename>               - Delete file or folder',
          '  cat <filename>              - Print file contents',
          '  echo "text" > <file>        - Write content to file',
          '  ./run.sh, ./build.sh        - Project build scripts',
          '  neofetch, clear             - System specs and screen clear'
        ];

      default:
        return [`bash: ${cmd}: command not found. Type 'help' for available commands.`];
    }
  }

  public getTermuxSetupScript(): string {
    return `#!/data/data/com.termux/files/usr/bin/bash
# Termux GUI Direct Bridge Daemon Installer
# SECURITY: this daemon binds to 127.0.0.1 only, requires a Bearer token,
# and only allows commands whose cwd is inside an allowed root. Set
# TERMUX_GUI_TOKEN to a long random token before starting it, and use the
# same token in the app settings. Never expose this daemon on 0.0.0.0 and
# never set Access-Control-Allow-Origin: * on it.
#   export TERMUX_GUI_TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \\n')"
pkg update -y && pkg install nodejs git curl -y
cat << 'EOF' > ~/termux_gui_daemon.js
const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const AUTH_TOKEN = process.env.TERMUX_GUI_TOKEN || '';
if (!AUTH_TOKEN) {
  console.error('TERMUX_GUI_TOKEN is not set. Refusing to start the daemon.');
  process.exit(1);
}
const ALLOWED_ROOTS = ['/storage/emulated/0', '/data/data/com.termux/files/home'];
function normalizePosix(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}
function isAllowedCwd(cwd) {
  if (!cwd || typeof cwd !== 'string' || cwd.includes('\\0')) return false;
  if (!cwd.startsWith('/')) return false;
  const n = normalizePosix(cwd);
  return ALLOWED_ROOTS.some((r) => n === r || n.startsWith(r + '/'));
}
function isAuthorized(req) {
  const h = req.headers.authorization || '';
  return h === 'Bearer ' + AUTH_TOKEN;
}

const server = http.createServer((req, res) => {
  // No CORS headers: only same-origin / localhost clients that present the
  // Bearer token may call this daemon. Do not add
  // Access-Control-Allow-Origin: * here.
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (!isAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', device: 'Moto G Power 2025' }));
  }

  if (req.url === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (body.length > 100000) { req.destroy(); } else body += chunk; });
    req.on('end', () => {
      try {
        const { command, cwd } = JSON.parse(body);
        if (!command || typeof command !== 'string' || command.includes('\\0') || command.length > 10000) {
          res.writeHead(400); return res.end(JSON.stringify({ error: 'invalid command' }));
        }
        if (!isAllowedCwd(cwd)) {
          res.writeHead(400); return res.end(JSON.stringify({ error: 'cwd outside allowed roots' }));
        }
        exec(command, { cwd: normalizePosix(cwd), timeout: 60000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ output: stdout || stderr || (err ? err.message : '') }));
        });
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(8080, '127.0.0.1', () => {
  console.log('[+] Termux GUI Daemon active on 127.0.0.1:8080');
});
EOF
node ~/termux_gui_daemon.js
`;
  }
}
