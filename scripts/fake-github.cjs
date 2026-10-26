#!/usr/bin/env node
/*
 * A stand-in for the GitHub REST API, for local checks and offline demos.
 *
 *   node scripts/fake-github.cjs          # listens on 127.0.0.1:4010
 *   GITHUB_API_BASE=http://127.0.0.1:4010 npm run dev
 *
 * It exists so the Build room can be exercised end to end without touching a
 * real repository: list repos, create a branch from main, read branches. Every
 * response is the shape GitHub actually returns for the endpoints lib/github.ts
 * calls. Nothing here is used in production.
 */

const http = require('node:http');

const PORT = Number(process.env.PORT || 4010);
const branches = ['main'];

const repos = [
  {
    full_name: 'onestop/checkout-web',
    private: true,
    default_branch: 'main',
    pushed_at: new Date().toISOString(),
    html_url: 'https://github.com/onestop/checkout-web',
    language: 'TypeScript',
  },
  {
    full_name: 'onestop/checkout-api',
    private: true,
    default_branch: 'main',
    pushed_at: new Date(Date.now() - 86400000).toISOString(),
    html_url: 'https://github.com/onestop/checkout-api',
    language: 'TypeScript',
  },
  {
    full_name: 'onestop/notes',
    private: false,
    default_branch: 'trunk',
    pushed_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    html_url: 'https://github.com/onestop/notes',
    language: null,
  },
];

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const path = url.pathname;
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return send(res, 401, { message: 'Requires authentication' });

    if (path === '/user') return send(res, 200, { login: 'amar-dev', name: 'Amar Tripathi', avatar_url: null });
    if (path === '/user/repos') return send(res, 200, repos);

    const repo = path.match(/^\/repos\/([\w.-]+)\/([\w.-]+)$/);
    if (repo && req.method === 'GET') {
      const found = repos.find((r) => r.full_name === `${repo[1]}/${repo[2]}`);
      if (!found) return send(res, 404, { message: 'Not Found' });
      return send(res, 200, found);
    }

    const ref = path.match(/^\/repos\/([\w.-]+)\/([\w.-]+)\/git\/ref\/heads\/([\w./-]+)$/);
    if (ref && req.method === 'GET') {
      const name = decodeURIComponent(ref[3]);
      if (!branches.includes(name)) return send(res, 404, { message: 'Not Found' });
      return send(res, 200, { ref: `refs/heads/${name}`, object: { sha: 'a1b2c3d4e5f6' } });
    }

    if (/^\/repos\/[\w.-]+\/[\w.-]+\/git\/refs$/.test(path) && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return send(res, 400, { message: 'Invalid JSON' });
        }
        const name = String(payload.ref || '').replace('refs/heads/', '');
        if (!name) return send(res, 422, { message: 'ref is required' });
        if (branches.includes(name)) return send(res, 422, { message: 'Reference already exists' });
        branches.push(name);
        send(res, 201, { ref: payload.ref, object: { sha: 'a1b2c3d4e5f6' } });
      });
      return undefined;
    }

    if (/^\/repos\/[\w.-]+\/[\w.-]+\/branches$/.test(path)) {
      return send(res, 200, branches.map((name) => ({ name })));
    }

    return send(res, 404, { message: 'Not Found' });
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`[fake-github] listening on http://127.0.0.1:${PORT} — GITHUB_API_BASE=http://127.0.0.1:${PORT}`);
  });
