import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const LOG_PREFIX = "[sverigevistelseplanerare lint] ";
const root = resolve(".");
const scanRoots = ["src", "scripts", "test"];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
}

function report(message) {
  process.stderr.write(LOG_PREFIX + message + "\n");
}

function canStartRegularExpression(masked, index) {
  const prefix = masked.slice(0, index).trimEnd();
  if (prefix.length === 0 || /[({[=,:;!&|?+\-*%^~<>]$/.test(prefix)) {
    return true;
  }
  return /(?:^|\b)(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)$/.test(
    prefix
  );
}

function executableJavaScript(source) {
  const masked = Array.from(source, () => " ");
  const contexts = [{ type: "code", templateExpression: false, braceDepth: 0 }];

  for (let index = 0; index < source.length; index += 1) {
    const context = contexts.at(-1);
    const character = source[index];
    const next = source[index + 1];

    if (context.type === "line-comment") {
      if (character === "\n") {
        contexts.pop();
        masked[index] = character;
      }
      continue;
    }

    if (context.type === "block-comment") {
      if (character === "*" && next === "/") {
        contexts.pop();
        index += 1;
      }
      continue;
    }

    if (["single-string", "double-string"].includes(context.type)) {
      const quote = context.type === "single-string" ? "'" : '"';
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        contexts.pop();
      }
      continue;
    }

    if (context.type === "regular-expression") {
      if (character === "\\") {
        index += 1;
      } else if (character === "[") {
        context.inCharacterClass = true;
      } else if (character === "]") {
        context.inCharacterClass = false;
      } else if (character === "/" && !context.inCharacterClass) {
        contexts.pop();
        while (/[a-z]/i.test(source[index + 1] ?? "")) {
          index += 1;
        }
      }
      continue;
    }

    if (context.type === "template") {
      if (character === "\\") {
        index += 1;
      } else if (character === "`") {
        contexts.pop();
      } else if (character === "$" && next === "{") {
        contexts.push({ type: "code", templateExpression: true, braceDepth: 1 });
        index += 1;
      }
      continue;
    }

    if (character === "/" && next === "/") {
      contexts.push({ type: "line-comment" });
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      contexts.push({ type: "block-comment" });
      index += 1;
      continue;
    }
    if (character === "'") {
      contexts.push({ type: "single-string" });
      continue;
    }
    if (character === '"') {
      contexts.push({ type: "double-string" });
      continue;
    }
    if (character === "`") {
      contexts.push({ type: "template" });
      continue;
    }
    if (character === "/" && canStartRegularExpression(masked.join(""), index)) {
      contexts.push({ type: "regular-expression", inCharacterClass: false });
      continue;
    }

    if (context.templateExpression && character === "{") {
      context.braceDepth += 1;
    } else if (context.templateExpression && character === "}") {
      context.braceDepth -= 1;
      if (context.braceDepth === 0) {
        contexts.pop();
        continue;
      }
    }
    masked[index] = character;
  }

  return masked.join("");
}

function hasConsoleCall(source) {
  return /\bconsole\s*(?:(?:\.|\?\.)\s*[A-Za-z_$][\w$]*\s*(?:\?\.)?\s*\(|\[)/.test(
    executableJavaScript(source)
  );
}

function attributeValue(tag, name) {
  const match = tag.match(new RegExp(
    "\\b" + name + "\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))",
    "i"
  ));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function hasUnsafeExternalLink(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  return [...withoutComments.matchAll(/<a\b[^>]*>/gi)].some(([tag]) => {
    const href = attributeValue(tag, "href") ?? "";
    const rel = attributeValue(tag, "rel") ?? "";
    return /^https?:\/\//i.test(href) &&
      !rel.split(/\s+/).some((value) => value.toLowerCase() === "noreferrer");
  });
}

async function lint() {
  let failed = false;
  const packagePath = join(root, "package.json");

  try {
    JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    report("Ogiltig package.json: " + error.message);
    failed = true;
  }

  const files = (await Promise.all(
    scanRoots.map((directory) => filesBelow(join(root, directory)))
  )).flat();
  const scripts = files.filter((path) => [".js", ".mjs"].includes(extname(path)));

  for (const path of scripts) {
    const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    if (checked.status !== 0) {
      report("Syntaxfel i " + relative(root, path) + ".");
      failed = true;
    }

    const text = await readFile(path, "utf8");
    if (path.startsWith(join(root, "src")) && hasConsoleCall(text)) {
      report("Console-anrop är inte tillåtna i src: " + relative(root, path));
      failed = true;
    }
  }

  const indexPath = join(root, "index.html");
  if (hasUnsafeExternalLink(await readFile(indexPath, "utf8"))) {
    report('Extern länk saknar rel="noreferrer": index.html');
    failed = true;
  }

  const textFiles = [...new Set([
    ...files,
    indexPath,
    join(root, "styles.css"),
    packagePath
  ])];

  for (const path of textFiles) {
    if (/[ \t]+$/m.test(await readFile(path, "utf8"))) {
      report("Trailing whitespace: " + relative(root, path));
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

lint().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  report(message);
  process.exitCode = 1;
});
