import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const LOG_PREFIX = "[sverigevistelseplanerare serve] ";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function isAllowed(relativePath) {
  return relativePath === "index.html" ||
    relativePath === "styles.css" ||
    relativePath.startsWith("src/");
}

function sendNotFound(response) {
  response.writeHead(404).end("Not found");
}

export function createStaticServer(rootDir) {
  const root = resolve(rootDir);

  return createServer(async (request, response) => {
    try {
      const rawPath = (request.url ?? "/").split("?", 1)[0];
      const decodedPath = decodeURIComponent(rawPath).replaceAll("\\", "/");
      const parts = decodedPath.split("/");

      if (parts.some((part) => part.startsWith("."))) {
        sendNotFound(response);
        return;
      }

      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
      const filePath = resolve(root, relativePath);
      const insideRoot = filePath === root || filePath.startsWith(root + sep);

      if (!insideRoot || !isAllowed(relativePath)) {
        sendNotFound(response);
        return;
      }

      const realRoot = await realpath(root);
      const realFilePath = await realpath(filePath);
      const insideRealRoot = realFilePath === realRoot || realFilePath.startsWith(realRoot + sep);
      if (!insideRealRoot) {
        sendNotFound(response);
        return;
      }

      const info = await stat(realFilePath);
      if (!info.isFile()) {
        sendNotFound(response);
        return;
      }

      const body = await readFile(realFilePath);
      response.writeHead(200, {
        "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store"
      }).end(body);
    } catch (error) {
      if (error?.code === "ENOENT") {
        sendNotFound(response);
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error(LOG_PREFIX + message);
      response.writeHead(500).end("Server error");
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (invokedPath === import.meta.url) {
  const rootDir = resolve(process.argv[2] ?? ".");
  const server = createStaticServer(rootDir);
  server.on("error", (error) => {
    console.error(LOG_PREFIX + error.message);
    process.exitCode = 1;
  });
  server.listen(4173, "127.0.0.1", () => {
    console.log(LOG_PREFIX + "http://127.0.0.1:4173");
  });
}
