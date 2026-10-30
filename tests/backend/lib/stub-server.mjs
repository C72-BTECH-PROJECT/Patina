// A local HTTP stub for core's internal-service clients (T-0014).
//
// Binds 127.0.0.1 and ::1 on the same port: on Windows "localhost" resolves to
// ::1 first, and a stub bound only on 127.0.0.1 is refused (the T-0009 probe
// does the same, tests/arch/nlp-outage-probe.mjs).
//
//   const stub = await startStub({ port: 0, handler: (req, res, rec) => json(res, 200, {...}) });
//   stub.url       http://localhost:<port>
//   stub.requests  [{ method, path, headers, body }]  (body parsed as JSON when possible)
//   stub.connections  number of TCP connections accepted
//   await stub.close()
import http from 'node:http';

export const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

export const raw = (res, status, text, contentType = 'application/json') => {
  res.writeHead(status, { 'content-type': contentType });
  res.end(text);
};

/** Accept the request and never answer. */
export const hang = () => {};

/** Drop the connection without a response (a connection error on the client). */
export const reset = (req) => req.socket.destroy();

const listen = (server, options) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options, () => {
      server.off('error', reject);
      resolve();
    });
  });

export async function startStub({ port = 0, handler } = {}) {
  const requests = [];
  const sockets = new Set();
  let connections = 0;

  const onRequest = (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch { /* keep the raw text */ }
      const rec = { method: req.method, path: req.url, headers: req.headers, body };
      requests.push(rec);
      handler(req, res, rec);
    });
  };

  const make = () => {
    const s = http.createServer(onRequest);
    s.on('connection', (sock) => {
      connections += 1;
      sockets.add(sock);
      sock.on('close', () => sockets.delete(sock));
    });
    return s;
  };

  const v4 = make();
  await listen(v4, { port, host: '127.0.0.1' });
  const bound = v4.address().port;
  const v6 = make();
  let v6ok = true;
  try { await listen(v6, { port: bound, host: '::1', ipv6Only: true }); } catch { v6ok = false; }

  const servers = v6ok ? [v4, v6] : [v4];
  return {
    port: bound,
    url: `http://localhost:${bound}`,
    requests,
    get connections() { return connections; },
    close: () => {
      for (const sock of sockets) sock.destroy();
      return Promise.all(servers.map((s) => new Promise((r) => s.close(() => r()))));
    },
  };
}
