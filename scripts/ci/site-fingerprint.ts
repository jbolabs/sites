/** Credential-free fingerprints of the Worker graph, assets and deployment inputs. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import ts from "typescript";

const Manifest = Schema.Struct({ key: Schema.String, rootDir: Schema.String });
const MANIFEST = /deserializeManifest\((?<json>\{[^\n]+\})\)/u;
const MODULE_REFERENCE = /(?<quote>["'])(?<specifier>[^"'\n]+\.mjs)\k<quote>/gu;
const EMDASH_BUILD_TIME =
  /(?<prefix>\/\/#region \\0virtual:emdash\/build\nvar buildTime = )\d+(?<suffix>;)/gu;
const Entries = Schema.Record(Schema.String, Schema.Unknown);
const Package = Schema.TupleWithRest(
  Schema.Tuple([Schema.String, Schema.String, Entries]),
  [Schema.Unknown]
);
const decodeEntries = Schema.decodeUnknownSync(Entries);

const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

export interface DeployAsset {
  readonly name: string;
  readonly bytes: Uint8Array;
  /** False for every copied public file, regardless of its URL or filename. */
  readonly generated: boolean;
}

export interface FingerprintFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** Sorted names and byte digests avoid metadata, enumeration order and ambiguous concatenation. */
export const fingerprintFiles = (files: readonly FingerprintFile[]): string =>
  digest(
    JSON.stringify(
      files
        .map(({ name, bytes }) => [name, digest(bytes)])
        .toSorted(([left = ""], [right = ""]) => left.localeCompare(right))
    )
  );

export const readTree = (directory: string, prefix = ""): FingerprintFile[] =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const name = `${prefix}${entry.name}`;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          return readTree(file, `${name}/`);
        }
        if (!entry.isFile()) {
          throw new Error(`Cannot fingerprint special file: ${file}`);
        }
        return [{ bytes: readFileSync(file), name }];
      })
    : [];

/**
 * Astro embeds its checkout root and generates a random server-island key per
 * build. Neither is a source change. Read only Astro's serialized manifest to
 * identify them. EmDash also emits a build timestamp, used to expire its
 * content cache across releases; source/output changes already invalidate this
 * fingerprint. Sort Astro's unordered entryModules map; preserve other values.
 */
export const normalizeModules = (
  files: ReadonlyMap<string, string>
): ReadonlyMap<string, string> => {
  const roots = new Set<string>();
  const manifests = new Map<string, string>();
  for (const [name, source] of files) {
    const json = MANIFEST.exec(source)?.groups?.json;
    if (json !== undefined) {
      const manifest = Schema.decodeUnknownSync(Manifest)(JSON.parse(json));
      const directory = new URL(manifest.rootDir).pathname;
      const root = directory.slice(0, directory.lastIndexOf("/apps/"));
      if (root === "" || !directory.includes("/apps/")) {
        throw new Error("Unknown Astro manifest root");
      }
      roots.add(root);
      const entries = decodeEntries(JSON.parse(json));
      const entryModules = decodeEntries(entries.entryModules ?? {});
      manifests.set(
        name,
        source.replace(
          json,
          JSON.stringify({
            ...entries,
            entryModules: Object.fromEntries(
              Object.entries(entryModules).toSorted(([a], [b]) =>
                a.localeCompare(b)
              )
            ),
            key: "<astro-build-key>",
          })
        )
      );
    }
  }
  if (roots.size !== 1) {
    throw new Error("Expected exactly one Astro checkout root");
  }
  return new Map(
    [...files].map(([name, source]) => {
      let normalized = (manifests.get(name) ?? source).replace(
        EMDASH_BUILD_TIME,
        "$<prefix>0$<suffix>"
      );
      for (const root of roots) {
        normalized = normalized.replaceAll(root, "<checkout>");
      }
      return [name, normalized];
    })
  );
};

/**
 * Walk the complete module graph in reference order, starting at the stable
 * entrypoints. Assign identities before traversing (cycles are allowed). This
 * removes only generated module filenames, not the edges between modules.
 * Disconnected modules are also hashed; ambiguous ordering fails closed.
 */
export const workerModules = (
  files: ReadonlyMap<string, string>
): readonly string[] => {
  if (!files.has("entry.mjs")) {
    throw new Error("Missing Worker entry.mjs");
  }
  const ids = new Map<string, number>();
  const queue: string[] = [];
  const identify = (name: string) => {
    if (!ids.has(name)) {
      ids.set(name, queue.length);
      queue.push(name);
    }
    return `<module:${ids.get(name)}>`;
  };
  const references = (
    name: string,
    source: string,
    replace: (target: string) => string
  ) =>
    source.replace(
      MODULE_REFERENCE,
      (match, quote: string, specifier: string) => {
        const relative = path.posix.normalize(
          path.posix.join(path.posix.dirname(name), specifier)
        );
        const target = files.has(specifier) ? specifier : relative;
        return files.has(target) ? `${quote}${replace(target)}${quote}` : match;
      }
    );
  identify("entry.mjs");
  for (const name of [...files.keys()]
    .filter((file) => !file.startsWith("chunks/"))
    .toSorted()) {
    identify(name);
  }
  const result: string[] = [];
  const drain = () => {
    while (result.length < queue.length) {
      const name = queue[result.length];
      if (name === undefined) {
        throw new Error("Missing module identity");
      }
      result.push(references(name, files.get(name) ?? "", identify));
    }
  };
  drain();
  const disconnected = [...files]
    .filter(([name]) => !ids.has(name))
    .map(([name, source]) => ({
      name,
      signature: references(name, source, () => "<module>"),
    }))
    .toSorted((a, b) => a.signature.localeCompare(b.signature));
  if (
    new Set(disconnected.map(({ signature }) => signature)).size !==
    disconnected.length
  ) {
    throw new Error("Ambiguous disconnected Worker modules");
  }
  for (const { name } of disconnected) {
    identify(name);
  }
  drain();
  return result;
};

export const workerGraph = (files: ReadonlyMap<string, string>): string =>
  digest(JSON.stringify(workerModules(files)));

const ASTRO_SCOPE =
  /(?<prefix>data-astro-cid-|astro-)(?<scope>[a-z0-9]{8})\b/gu;
const GENERATED_ASSETS = "client/_astro/";
const TEXT_ASSET = /\.(?:css|js|mjs|svg|json|html|txt)$/u;

const CSS_SCOPE = /\[data-astro-cid-(?<scope>[a-z0-9]{8})\]/gu;
const ASSET_HASH = /\.[A-Za-z0-9_-]{8}(?=\.[^.]+$)/u;
const FONT_HASH = /^[a-f0-9]{16}(?=\.)/u;
const ABSOLUTE_ASSET = /_astro\/[^"'`()\s\\]*$/u;
const RELATIVE_ASSET = /(?:["'`(]\.{1,2}\/|url\(["'`]?)[^"'`()\s]*$/u;

const semanticAssetName = (name: string) =>
  path.posix
    .basename(name)
    .replace(ASSET_HASH, ".<hash>")
    .replace(FONT_HASH, "<font>");

const generatedScopes = (assets: readonly DeployAsset[]) =>
  new Set(
    assets
      .filter(
        ({ generated, name }) =>
          generated &&
          name.startsWith(GENERATED_ASSETS) &&
          name.endsWith(".css")
      )
      .flatMap(({ bytes }) =>
        [...Buffer.from(bytes).toString("utf-8").matchAll(CSS_SCOPE)].flatMap(
          (match) => match.groups?.scope ?? []
        )
      )
  );

const propertyName = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  ) {
    return name.expression.text;
  }
  return undefined;
};

const INLINE_CSS =
  /(?<prefix>\{"type":"inline","content":")(?<css>(?:[^"\\]|\\.)*)"\}/gu;

const CSS_CONTAINER = /^@(?:media|supports|layer|container|document|scope)\b/u;
const CSS_TOKENS =
  /\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?<open>\{)|(?<close>\})|(?<separator>;)|(?<scope>\[data-astro-cid-[a-z0-9]{8}\]|\.astro-[a-z0-9]{8}\b)/gu;

const cssScopePositions = (source: string): ReadonlySet<number> => {
  const positions = new Set<number>();
  const blocks: boolean[] = [];
  let boundary = 0;
  for (const token of source.matchAll(CSS_TOKENS)) {
    const groups = token.groups ?? {};
    if (groups.open !== undefined) {
      blocks.push(
        CSS_CONTAINER.test(source.slice(boundary, token.index).trim())
      );
      boundary = token.index + 1;
    } else if (groups.close !== undefined) {
      blocks.pop();
      boundary = token.index + 1;
    } else if (groups.separator !== undefined) {
      boundary = token.index + 1;
    } else if (groups.scope !== undefined && blocks.at(-1) !== false) {
      positions.add(token.index + 1);
    }
  }
  return positions;
};

const inlineStyles = (source: string) => {
  const manifest = MANIFEST.exec(source);
  const json = manifest?.groups?.json;
  if (json === undefined || manifest === null) {
    return [];
  }
  const start = source.indexOf(json, manifest.index);
  return [...json.matchAll(INLINE_CSS)].map((inline) => ({
    offset: start + inline.index + (inline.groups?.prefix ?? "").length,
    raw: inline.groups?.css ?? "",
    text: Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String))(
      `"${inline.groups?.css ?? ""}"`
    ),
  }));
};

const HTML_TAG = /<[a-z](?:[^>"']|"[^"]*"|'[^']*')*>/giu;
const HTML_ATTRIBUTE =
  /(?<name>[^\s"'=<>`]+)(?:\s*=\s*(?<value>"[^"]*"|'[^']*'|[^\s>]+))?/gu;

const htmlScopes = (source: string): ReadonlySet<number> => {
  const positions = new Set<number>();
  for (const tag of source.matchAll(HTML_TAG)) {
    for (const attribute of tag[0].matchAll(HTML_ATTRIBUTE)) {
      const name = attribute.groups?.name ?? "";
      if (/^data-astro-cid-[a-z0-9]{8}$/u.test(name)) {
        positions.add(tag.index + attribute.index);
      }
      if (name === "class") {
        for (const token of attribute[0].matchAll(ASTRO_SCOPE)) {
          positions.add(tag.index + attribute.index + token.index);
        }
      }
    }
  }
  return positions;
};

const compilerProps = (node: ts.ObjectLiteralExpression): boolean => {
  const call = node.parent;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
    return false;
  }
  if (/^renderComponent\d*$/u.test(call.expression.text)) {
    return call.arguments[3] === node;
  }
  return (
    /^spreadAttributes\d*$/u.test(call.expression.text) &&
    call.arguments[2] === node
  );
};

/** Only HTML attributes, Astro renderer props and manifest styles are identities. */
const scopePositions = (source: string): ReadonlySet<number> => {
  const positions = new Set<number>();
  const file = ts.createSourceFile(
    "worker.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const add = (
    raw: string,
    decoded: string,
    start: number,
    valid: ReadonlySet<number>
  ) => {
    const tokens = [...decoded.matchAll(ASTRO_SCOPE)];
    for (const [index, token] of [...raw.matchAll(ASTRO_SCOPE)].entries()) {
      const decodedToken = tokens[index];
      if (decodedToken !== undefined && valid.has(decodedToken.index)) {
        positions.add(start + token.index);
      }
    }
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      const renderer = compilerProps(node.parent);
      const name = propertyName(node.name);
      if (
        renderer &&
        name?.startsWith("data-astro-cid-") === true &&
        node.initializer.kind === ts.SyntaxKind.TrueKeyword
      ) {
        const start = node.name.getStart(file);
        for (const match of node.name.getText(file).matchAll(ASTRO_SCOPE)) {
          positions.add(start + match.index);
        }
      }
      if (
        renderer &&
        name === "class" &&
        ts.isStringLiteral(node.initializer)
      ) {
        for (const token of node.initializer
          .getText(file)
          .matchAll(ASTRO_SCOPE)) {
          positions.add(node.initializer.getStart(file) + token.index);
        }
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      add(
        node.getText(file),
        node.text,
        node.getStart(file),
        htmlScopes(node.text)
      );
    }
    if (ts.isTemplateExpression(node)) {
      const literals = [
        node.head,
        ...node.templateSpans.map((span) => span.literal),
      ];
      const decoded = literals.map((literal) => literal.text).join(" ");
      const valid = htmlScopes(decoded);
      let offset = 0;
      for (const literal of literals) {
        const start = offset;
        const local = new Set(
          [...valid]
            .filter(
              (index) => index >= start && index < start + literal.text.length
            )
            .map((index) => index - start)
        );
        add(literal.getText(file), literal.text, literal.getStart(file), local);
        offset += literal.text.length + 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  for (const style of inlineStyles(source)) {
    add(style.raw, style.text, style.offset, cssScopePositions(style.text));
  }
  return positions;
};

const AUTHORED_SCOPE = /(?:data-astro-cid-|astro-)(?<scope>[a-z0-9]{8})/gu;
const ESCAPED_INPUT = /\\(?:u|x|\r?\n)/u;

const authoredScopeText = (bytes: Uint8Array): string => {
  const raw = Buffer.from(bytes).toString("utf-8");
  // Unknown source formats (Astro/CSS/MDX included) cannot establish complete
  // decoding coverage. Retain escaped inputs instead of trusting a partial AST.
  if (ESCAPED_INPUT.test(raw)) {
    throw new Error("Authored scope token; retaining candidate");
  }
  const literals: string[] = [];
  for (const kind of [ts.ScriptKind.TS, ts.ScriptKind.TSX]) {
    const file = ts.createSourceFile(
      "input",
      raw,
      ts.ScriptTarget.Latest,
      true,
      kind
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        literals.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  // Keep individual boundaries as well as a conservative folded representation.
  // AUTHORED_SCOPE intentionally has no trailing boundary: joining must only add coverage.
  return [raw, ...literals, literals.join("")].join("\n");
};

/** Astro scopes and generated asset names depend on absolute installation paths.
 * Give scopes coherent identities in Worker traversal order. Give generated
 * assets identities by their content, retaining every byte and every reference.
 * A tie cannot be safely ordered, so it fails closed rather than guessing.
 */
export const deployableFiles = (
  modules: readonly string[],
  assets: readonly DeployAsset[],
  authored: readonly Uint8Array[] = []
): readonly FingerprintFile[] => {
  const known = generatedScopes(assets);
  for (const source of modules) {
    for (const style of inlineStyles(source)) {
      for (const match of style.text.matchAll(CSS_SCOPE)) {
        const scope = match.groups?.scope;
        if (scope !== undefined) {
          known.add(scope);
        }
      }
    }
  }
  // A scope present in authored input cannot safely be treated as compiler metadata.
  // This also protects unusual HTML/renderer syntax that resembles generated props.
  for (const bytes of authored) {
    for (const match of authoredScopeText(bytes).matchAll(AUTHORED_SCOPE)) {
      if (known.has(match.groups?.scope ?? "")) {
        throw new Error("Authored scope token; retaining candidate");
      }
    }
  }
  const scopes = new Map<string, number>();
  const scopeText = (source: string, discover: boolean, css = false) => {
    const verified = css ? cssScopePositions(source) : scopePositions(source);
    return source.replace(
      ASTRO_SCOPE,
      (match, prefix: string, scope: string, offset: number) => {
        if (!known.has(scope)) {
          return match;
        }
        if (!verified.has(offset)) {
          throw new Error("Ambiguous scope-like literal; retaining candidate");
        }
        if (!scopes.has(scope)) {
          if (!discover) {
            throw new Error("Unknown generated asset scope");
          }
          scopes.set(scope, scopes.size);
        }
        return `${prefix}<scope:${scopes.get(scope)}>`;
      }
    );
  };
  const worker = modules.map((source) => scopeText(source, true));
  const generated = assets.filter(
    (asset) => asset.generated && asset.name.startsWith(GENERATED_ASSETS)
  );
  const basenames = generated.map(({ name }) => path.posix.basename(name));
  if (new Set(basenames).size !== basenames.length) {
    throw new Error("Ambiguous generated asset basename");
  }
  const rewrite = (source: string, target: (basename: string) => string) => {
    let next = source;
    for (const basename of basenames) {
      const previous = next;
      next = previous.replaceAll(basename, (_match, offset: number) => {
        const before = previous.slice(Math.max(0, offset - 200), offset);
        if (!ABSOLUTE_ASSET.test(before) && !RELATIVE_ASSET.test(before)) {
          throw new Error(
            "Ambiguous generated asset reference; retaining candidate"
          );
        }
        return target(basename);
      });
    }
    return next;
  };
  const text = new Map(
    generated
      .filter(({ name }) => TEXT_ASSET.test(name))
      .map(({ name, bytes }) => [
        name,
        scopeText(
          Buffer.from(bytes).toString("utf-8"),
          false,
          name.endsWith(".css")
        ),
      ])
  );
  const signatures = generated
    .map(({ name, bytes }) => ({
      name,
      signature: `${path.posix.dirname(name)}/${semanticAssetName(name)}:${digest(
        text.has(name) ? rewrite(text.get(name) ?? "", () => "<asset>") : bytes
      )}`,
    }))
    .toSorted((a, b) => a.signature.localeCompare(b.signature));
  if (
    new Set(signatures.map(({ signature }) => signature)).size !==
    signatures.length
  ) {
    throw new Error("Ambiguous generated asset contents");
  }
  const identities = new Map(
    signatures.map(({ name }, index) => [
      path.posix.basename(name),
      `${semanticAssetName(name)}<asset:${index}>`,
    ])
  );
  const replace = (source: string) =>
    rewrite(source, (basename) => identities.get(basename) ?? basename);
  const normalizedWorker = worker.map((source) => {
    const replaced = replace(source);
    const json = MANIFEST.exec(replaced)?.groups?.json;
    if (json === undefined) {
      return replaced;
    }
    const manifest = decodeEntries(JSON.parse(json));
    const entries = Schema.decodeUnknownSync(Schema.Array(Schema.String))(
      manifest.assets ?? []
    );
    return replaced.replace(
      json,
      JSON.stringify({ ...manifest, assets: entries.toSorted() })
    );
  });
  return [
    {
      bytes: Buffer.from(JSON.stringify(normalizedWorker)),
      name: "worker-graph",
    },
    ...assets.filter(
      (asset) => !asset.generated || !asset.name.startsWith(GENERATED_ASSETS)
    ),
    ...generated.map(({ name, bytes }) => ({
      bytes: text.has(name)
        ? Buffer.from(replace(text.get(name) ?? ""))
        : bytes,
      name: `${path.posix.dirname(name)}/${identities.get(path.posix.basename(name)) ?? name}`,
    })),
  ];
};

const packageName = (specifier: string) =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : (specifier.split("/")[0] ?? specifier);

/** Include all resolutions of stack/config dependencies and their transitive peers.
 * Multiple installed versions are deliberately conservative; unrelated new-site
 * dependencies do not invalidate existing stacks. Unknown lock formats throw.
 */
export const deploymentResolutions = (
  packages: Schema.Schema.Type<typeof Entries>,
  imports: readonly string[]
): string => {
  const pending = imports.map(packageName);
  const visited = new Set<string>();
  const selected = new Map<string, unknown>();
  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined || visited.has(name)) {
      continue;
    }
    visited.add(name);
    const matches = Object.entries(packages).filter(
      ([key]) => key === name || key.endsWith(`/${name}`)
    );
    if (matches.length === 0) {
      throw new Error(`Missing deployment dependency: ${name}`);
    }
    for (const [key, value] of matches) {
      selected.set(key, value);
      const { 2: metadata } = Schema.decodeUnknownSync(Package)(value);
      for (const field of [
        "dependencies",
        "optionalDependencies",
        "peerDependencies",
      ]) {
        const dependencies = decodeEntries(metadata[field] ?? {});
        for (const dependency of Object.keys(dependencies)) {
          // Optional peers/platform packages can be absent from the lockfile.
          if (
            field === "dependencies" ||
            Object.keys(packages).some(
              (resolution) =>
                resolution === dependency ||
                resolution.endsWith(`/${dependency}`)
            )
          ) {
            pending.push(dependency);
          }
        }
      }
    }
  }
  return JSON.stringify(
    [...selected].toSorted(([a], [b]) => a.localeCompare(b))
  );
};

/** Bundle config without executing it. Workspace code is included; third-party
 * packages stay external and their exact lock resolutions are fingerprinted.
 * This covers stage-only branches (e.g. email) absent from the verification build.
 */
export const registeredEntrypoints = (
  source: string,
  runtimeModule = false
): readonly string[] => {
  const file = ts.createSourceFile(
    "config.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const entries: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(
        node.properties.flatMap((property) =>
          property.name === undefined ? [] : (propertyName(property.name) ?? [])
        )
      );
      const plugin =
        names.has("id") && (names.has("version") || names.has("capabilities"));
      const descriptor = names.has("format") || names.has("pattern") || plugin;
      for (const property of node.properties) {
        const { name } = property;
        const unknownName =
          name !== undefined &&
          ts.isComputedPropertyName(name) &&
          propertyName(name) === undefined;
        if (unknownName && (!runtimeModule || descriptor)) {
          throw new Error("Cannot resolve computed runtime registration");
        }
        if (
          property.name === undefined ||
          propertyName(property.name) !== "entrypoint"
        ) {
          continue;
        }
        if (!ts.isPropertyAssignment(property)) {
          throw new Error("Cannot resolve dynamic runtime entrypoint");
        }
        const value = property.initializer;
        if (
          !ts.isStringLiteral(value) &&
          !ts.isNoSubstitutionTemplateLiteral(value)
        ) {
          throw new Error("Cannot resolve dynamic runtime entrypoint");
        }
        entries.push(value.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return entries;
};

export const configuration = async (directory: string, site: string) => {
  const root = realpathSync(directory);
  const imports = new Set<string>();
  const assets = new Map<string, FingerprintFile>();
  const entrypoints = [
    path.join(root, "apps", site, "alchemy.run.ts"),
    path.join(root, "apps", site, "astro.config.ts"),
  ];
  const bundle = async (entries: readonly string[]) =>
    await Bun.build({
      entrypoints: [...entries],
      minify: { whitespace: true },
      packages: "external",
      plugins: [
        {
          name: "fingerprint-workspaces",
          setup(build) {
            build.onResolve({ filter: /\?(?:url|raw)(?:&|$)/u }, (args) => {
              const file = path.resolve(
                path.dirname(args.importer),
                args.path.split("?")[0] ?? ""
              );
              assets.set(file, {
                bytes: readFileSync(file),
                name: path.relative(root, file),
              });
              return { external: true, path: path.relative(root, file) };
            });
            build.onResolve({ filter: /^[\w@]/u }, (args) => {
              if (args.path.startsWith("@jakebodea/")) {
                return {
                  path: Bun.resolveSync(args.path, path.dirname(args.importer)),
                };
              }
              if (!args.path.includes(":")) {
                imports.add(args.path);
              }
              return null;
            });
          },
        },
      ],
      target: "bun",
    });
  const entries = new Set(entrypoints);
  let sources: string[] = [];
  // Plugin descriptors name runtime modules by string, not import. Include all
  // their exports and discover nested descriptors, without executing any config.
  for (let round = 0; round < 8; round += 1) {
    const result = await bundle([...entries]);
    if (!result.success) {
      throw new AggregateError(
        result.logs,
        "Cannot fingerprint deployment configuration"
      );
    }
    sources = await Promise.all(
      result.outputs.map(async (output) => {
        const source = await output.text();
        return source.replaceAll(root, "<checkout>");
      })
    );
    const previous = entries.size;
    for (const source of sources) {
      for (const specifier of registeredEntrypoints(source, round > 0)) {
        entries.add(Bun.resolveSync(specifier, path.join(root, "apps", site)));
      }
    }
    if (entries.size === previous) {
      break;
    }
    if (round === 7) {
      throw new Error("Unbounded registered runtime entrypoints");
    }
  }
  const lock = decodeEntries(
    Bun.JSONC.parse(readFileSync(path.join(root, "bun.lock"), "utf-8"))
  );
  return JSON.stringify({
    assets: fingerprintFiles([...assets.values()]),
    // Patches/overrides and future lock metadata may affect external stack code.
    metadata: Object.fromEntries(
      Object.entries(lock).filter(
        ([key]) =>
          !["packages", "workspaces", "catalog", "catalogs"].includes(key)
      )
    ),
    resolutions: deploymentResolutions(decodeEntries(lock.packages), [
      ...imports,
    ]),
    sources,
  });
};

export const sitePayload = async (
  root: string,
  site: string
): Promise<readonly FingerprintFile[]> => {
  const directory = path.join(root, "apps", site);
  const server = readTree(path.join(directory, "dist/server"));
  const publicFiles = new Set(
    readTree(path.join(directory, "public"), "client/").map(({ name }) => name)
  );
  const client = readTree(path.join(directory, "dist/client"), "client/").map(
    (file) => ({ ...file, generated: !publicFiles.has(file.name) })
  );
  if (!existsSync(path.join(directory, "dist/client"))) {
    throw new Error("Missing Worker assets");
  }
  const modules = new Map(
    server
      .filter(({ name }) => name.endsWith(".mjs"))
      .map(({ name, bytes }) => [name, Buffer.from(bytes).toString("utf-8")])
  );
  const authored = execFileSync(
    "git",
    ["ls-files", "-z", "--", `apps/${site}`, "packages", "stacks"],
    { cwd: root, encoding: "utf-8" }
  )
    .split("\0")
    .filter(
      (file) =>
        /\.(?:[cm]?[jt]sx?|astro|css|json|mdx?|html)$/u.test(file) &&
        !file.includes(".test.") &&
        !/^packages\/(?:control-app|proof|config)\//u.test(file)
    )
    .map((file) => readFileSync(path.join(root, file)));
  return [
    ...deployableFiles(
      workerModules(normalizeModules(modules)),
      client,
      authored
    ),
    ...server
      .filter(({ name }) => !name.endsWith(".mjs"))
      .map((file) => ({ ...file, name: `server/${file.name}` })),
    ...readTree(path.join(directory, "seed"), "seed/"),
    ...["deploy.ts", "migrate.ts", "prepare-content.ts"].map((name) => ({
      bytes: readFileSync(path.join(root, "scripts/ci", name)),
      name: `deploy-tools/${name}`,
    })),

    {
      bytes: Buffer.from(await configuration(root, site)),
      name: "configuration",
    },
    {
      bytes: readFileSync(path.join(directory, "site.config.ts")),
      name: "site.config.ts",
    },
  ];
};

export const siteFingerprint = async (
  root: string,
  site: string
): Promise<string> => {
  const payload = await sitePayload(root, site);
  return fingerprintFiles(payload);
};
