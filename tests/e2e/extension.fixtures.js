const { test: base, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const http = require("http");
const ROOT_DIR = path.resolve(__dirname, "../../");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon"
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, "http://localhost");
      let filePath = path.join(ROOT_DIR, decodeURIComponent(requestUrl.pathname));
      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.stat(filePath, (err, stats) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        if (stats.isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
        fs.readFile(filePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
          res.end(data);
        });
      });
    });
    server.listen(0, () => {
      resolve({
        port: server.address().port,
        close: () =>
          new Promise((resolveClose) => {
            server.close(resolveClose);
          })
      });
    });
  });
}

const test = base.extend({
  staticServer: [
    async ({}, use) => {
      const server = await startStaticServer();
      await use(server);
      await server.close();
    },
    { scope: "worker" }
  ],
  harnessUrl: [
    async ({ staticServer }, use) => {
      const url = `http://127.0.0.1:${staticServer.port}/tests/harness/popup-harness.html`;
      await use(url);
    },
    { scope: "worker" }
  ]
});

module.exports = {
  test,
  expect
};
