'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRuntime } = require('./runtime');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const runtime = createRuntime({ version: packageJson.version });
const noOpen = process.argv.includes('--no-open');
const requestedPort = Number(process.env.OPS_TOOLKIT_PORT) || 48731;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function sendJson(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  response.end(text);
}

function readRequestBody(request, limitBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Request body is too large'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(publicDir, normalized);
  if (decoded.endsWith('/') || !path.extname(target)) target = path.join(target, 'index.html');
  const resolved = path.resolve(target);
  if (!resolved.startsWith(publicDir)) return null;
  return resolved;
}

async function handleRpc(request, response) {
  try {
    const raw = await readRequestBody(request);
    const body = raw ? JSON.parse(raw) : {};
    const data = await runtime.rpc(body.action, body.payload || {});
    sendJson(response, 200, { ok: true, data });
  } catch (error) {
    sendJson(response, error.status || 500, {
      ok: false,
      error: error.message || String(error),
      code: error.code,
      status: error.status
    });
  }
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://127.0.0.1');
  const filePath = safeStaticPath(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === 'POST' && request.url.startsWith('/api/rpc')) {
      void handleRpc(request, response);
      return;
    }
    if (request.method === 'GET' && request.url.startsWith('/api/health')) {
      sendJson(response, 200, { ok: true, version: packageJson.version, mode: 'desktop' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405);
      response.end('Method not allowed');
      return;
    }
    serveStatic(request, response);
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function listenWithFallback() {
  for (let offset = 0; offset < 20; offset += 1) {
    const server = createServer();
    const port = requestedPort + offset;
    try {
      await listen(server, port);
      return { server, port };
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No free port found starting at ${requestedPort}`);
}

function browserCandidates() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.PROGRAMFILES || '';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || '';
  return [
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
}

function openDesktopWindow(url) {
  const browser = browserCandidates().find(candidate => fs.existsSync(candidate));
  if (browser) {
    const profileDir = path.join(process.env.APPDATA || os.homedir(), 'ops-toolkit-desktop', 'browser-profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const child = spawn(browser, [`--app=${url}`, `--user-data-dir=${profileDir}`, '--no-first-run'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return true;
  }
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  return false;
}

(async () => {
  const { port } = await listenWithFallback();
  const url = `http://127.0.0.1:${port}/`;
  console.log(`OPS Toolkit Desktop server: ${url}`);
  console.log('Press Ctrl+C to stop the background server.');
  if (!noOpen) openDesktopWindow(url);
})().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
