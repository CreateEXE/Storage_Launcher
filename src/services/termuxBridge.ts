import { FileManagerService } from './fileManager';

export interface TermuxBridgeConfig {
  mode: 'virtual' | 'direct';
  endpoint: string; // e.g. "http://localhost:8080"
  authToken?: string;
  isConnected: boolean;
}

const CONFIG_KEY = 'termux_bridge_config_v1';

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
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
  }

  public getCurrentDir(): string {
    return this.currentDir;
  }

  public setCurrentDir(dir: string): void {
    this.currentDir = dir;
  }

  public async testConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        this.setConfig({ endpoint, isConnected: true, mode: 'direct' });
        return { success: true, message: 'Connected to Termux daemon successfully.' };
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

    // If direct mode enabled and endpoint configured, try sending to Termux HTTP daemon
    if (this.config.mode === 'direct' && this.config.endpoint) {
      try {
        const response = await fetch(`${this.config.endpoint.replace(/\/+$/, '')}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.authToken ? { 'Authorization': `Bearer ${this.config.authToken}` } : {})
          },
          body: JSON.stringify({ command: trimmed, cwd: this.currentDir })
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.output)) return data.output;
          return String(data.output || '').split('\n');
        }
      } catch {
        // Fall back to virtual engine with notice
        return [
          `[!] Direct Termux connection unreachable at ${this.config.endpoint}. Falling back to In-Engine Shell...`,
          ...this.executeVirtual(trimmed)
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
        if (args.startsWith('/')) {
          this.currentDir = args;
        } else {
          this.currentDir = `${this.currentDir.replace(/\/+$/, '')}/${args}`;
        }
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
pkg update -y && pkg install nodejs git curl -y
cat << 'EOF' > ~/termux_gui_daemon.js
const http = require('http');
const { exec } = require('child_process');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', device: 'Moto G Power 2025' }));
  }

  if (req.url === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { command, cwd } = JSON.parse(body);
        exec(command, { cwd: cwd || process.env.HOME }, (err, stdout, stderr) => {
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

server.listen(8080, '0.0.0.0', () => {
  console.log('[+] Termux GUI Daemon active on port 8080');
});
EOF
node ~/termux_gui_daemon.js
`;
  }
}
