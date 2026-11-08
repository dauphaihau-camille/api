#!/usr/bin/env node

/**
 * PR-time contract gate for the published OpenAPI artifact.
 *
 * `api/openapi.json` is the authoritative contract and ships as
 * `@dauphaihau-camille/api-spec` (GitHub Packages). The publish workflow already
 * refuses a breaking change unless the major version moves. This script moves
 * the same reasoning in front of the merge, and adds the missing half: a
 * contract change must be accompanied by the semver bump that matches the
 * change (ERR -> major, WARN or additive structure -> minor, documentation-only
 * -> patch). oasdiff reports added endpoints and optional properties as INFO,
 * so the structural comparison is what keeps additive changes in a minor.
 *
 * Comparison happens against the last published tarball, not against the
 * working tree, because that is the contract consumers compiled against. A
 * byte-identical document short-circuits before any version rule applies.
 *
 * Usage (from the repository root):
 *
 *   node api/scripts/check-contract-breaking.mjs [options]
 *
 * Options:
 *   --candidate <path>         Candidate spec (default: api/openapi.json)
 *   --manifest <path>          Candidate package manifest
 *                              (default: packages/api-spec/package.json)
 *   --baseline-spec <path>     Compare against a local spec instead of the
 *                              registry; requires --baseline-version
 *   --baseline-version <x.y.z> Baseline version for --baseline-spec
 *   --package <name>           Published package name
 *                              (default: @dauphaihau-camille/api-spec)
 *   --registry <url>           npm registry
 *                              (default: https://npm.pkg.github.com)
 *   --oasdiff <path>           oasdiff binary (default: $OASDIFF_BIN, then
 *                              `oasdiff` on PATH, then the pinned release for
 *                              linux/amd64)
 *   --help, -h                 Print this help
 *
 * Exit codes:
 *   0  the candidate passes, or there is no baseline to compare against
 *   1  breaking/bump violation, or the tooling failed (fail closed)
 *   2  invalid CLI usage
 *
 * Requires only Node builtins. oasdiff must emit `changelog --format json`
 * entries with a numeric `level` (1 = INFO, 2 = WARN, 3 = ERR).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** `api/scripts/` -> repository root (`.git` owner). */
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const DEFAULTS = {
  candidate: path.join(REPO_ROOT, 'api', 'openapi.json'),
  manifest: path.join(REPO_ROOT, 'packages', 'api-spec', 'package.json'),
  package: '@dauphaihau-camille/api-spec',
  registry: 'https://npm.pkg.github.com',
};

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const LEVEL_NAMES = new Map([
  [1, 'INFO'],
  [2, 'WARN'],
  [3, 'ERR'],
]);

const LEVEL_REQUIREMENTS = new Map([
  [1, 'patch'],
  [2, 'minor'],
  [3, 'major'],
]);

/**
 * Keys that only carry documentation. A document that differs solely in these
 * keys is a patch-level change; anything else that is not breaking is
 * additive and requires a minor, because consumers' generated types change.
 *
 * `info.version` is excluded too: the document's own version is static and
 * must not decide the bump.
 */
const DOCUMENTATION_ONLY_KEYS = new Set([
  'description',
  'example',
  'examples',
  'externalDocs',
  'summary',
  'title',
]);

const OASDIFF_PINNED_VERSION = 'v1.35.0';
const OASDIFF_PINNED_SHA256 =
  'a8023002fcb2eaa7f5758148a9303cb63d33b939886df312268bc0fc7b939140';
const OASDIFF_PINNED_ARCHIVE = 'oasdiff_1.35.0_linux_amd64.tar.gz';
const OASDIFF_PINNED_URL =
  'https://github.com/oasdiff/oasdiff/releases/download/' +
  `${OASDIFF_PINNED_VERSION}/${OASDIFF_PINNED_ARCHIVE}`;

const USAGE = `Usage: node api/scripts/check-contract-breaking.mjs [options]

Compare api/openapi.json with the last published contract and enforce the
semver bump the change requires: ERR -> major, WARN or any additive structural
change -> minor, documentation-only -> patch.

Options:
  --candidate <path>          Candidate spec (default: api/openapi.json)
  --manifest <path>           Candidate manifest
                              (default: packages/api-spec/package.json)
  --baseline-spec <path>      Compare against a local spec instead of the
                              registry; requires --baseline-version
  --baseline-version <x.y.z>  Baseline version for --baseline-spec
  --package <name>            Published package name
                              (default: @dauphaihau-camille/api-spec)
  --registry <url>            npm registry
                              (default: https://npm.pkg.github.com)
  --oasdiff <path>            oasdiff binary (default: $OASDIFF_BIN, then
                              PATH, then the pinned linux/amd64 release)
  --help, -h                  Print this help

Exit codes: 0 pass or no baseline, 1 violation/tool failure, 2 invalid usage.`;

const VALUE_FLAGS = new Map([
  ['--candidate', 'candidate'],
  ['--manifest', 'manifest'],
  ['--baseline-spec', 'baselineSpec'],
  ['--baseline-version', 'baselineVersion'],
  ['--package', 'package'],
  ['--registry', 'registry'],
  ['--oasdiff', 'oasdiff'],
]);

class UsageError extends Error {}
class FatalError extends Error {}

const cleanupDirs = [];

/** Parse argv strictly: no positional arguments, no unknown flags. */
function parseArgs(argv) {
  const options = {
    candidate: DEFAULTS.candidate,
    manifest: DEFAULTS.manifest,
    package: DEFAULTS.package,
    registry: DEFAULTS.registry,
    baselineSpec: undefined,
    baselineVersion: undefined,
    oasdiff: undefined,
    help: false,
  };

  const tokens = argv.filter((token) => token !== '--');

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    let flag = token;
    let inlineValue;

    if (token.startsWith('--') && token.includes('=')) {
      const separator = token.indexOf('=');
      flag = token.slice(0, separator);
      inlineValue = token.slice(separator + 1);
    }

    const key = VALUE_FLAGS.get(flag);

    if (key === undefined) {
      throw new UsageError(`Unknown argument: ${token}`);
    }

    let value = inlineValue;

    if (value === undefined) {
      value = tokens[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`Missing value for ${flag}`);
      }
      index += 1;
    }

    if (value === '') {
      throw new UsageError(`Empty value for ${flag}`);
    }

    options[key] = value;
  }

  if (options.help) {
    return options;
  }

  if (options.baselineSpec !== undefined && options.baselineVersion === undefined) {
    throw new UsageError('--baseline-spec requires --baseline-version');
  }

  if (options.baselineVersion !== undefined && options.baselineSpec === undefined) {
    throw new UsageError('--baseline-version is only valid with --baseline-spec');
  }

  if (
    options.baselineVersion !== undefined
    && parseSemver(options.baselineVersion) === undefined
  ) {
    throw new UsageError(
      `--baseline-version must be a plain semver string, found ${options.baselineVersion}`,
    );
  }

  return options;
}

function parseSemver(version) {
  if (typeof version !== 'string') {
    return undefined;
  }

  const match = SEMVER_PATTERN.exec(version);
  if (match === null) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareCore(left, right) {
  if (left.major !== right.major) {
    return left.major < right.major ? -1 : 1;
  }
  if (left.minor !== right.minor) {
    return left.minor < right.minor ? -1 : 1;
  }
  if (left.patch !== right.patch) {
    return left.patch < right.patch ? -1 : 1;
  }
  return 0;
}

function satisfiesBump(required, candidate, baseline) {
  if (required === 'major') {
    return candidate.major > baseline.major;
  }
  if (required === 'minor') {
    return (
      candidate.major > baseline.major
      || (candidate.major === baseline.major && candidate.minor > baseline.minor)
    );
  }
  return compareCore(candidate, baseline) > 0;
}

function nextVersion(required, baseline) {
  if (required === 'major') {
    return `${baseline.major + 1}.0.0`;
  }
  if (required === 'minor') {
    return `${baseline.major}.${baseline.minor + 1}.0`;
  }
  return `${baseline.major}.${baseline.minor}.${baseline.patch + 1}`;
}

/** Run a command and return its result, translating a missing binary. */
function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error !== undefined && result.error !== null) {
    if (result.error.code === 'ENOENT') {
      throw new FatalError(
        `Command not found: ${command}. Install it or pass --oasdiff <path>.`,
      );
    }
    throw new FatalError(`Could not run ${command}: ${result.error.message}`);
  }

  return result;
}

function describeFailure(command, args, result) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return (
    `${command} ${args.join(' ')} exited with status ${result.status}` +
    (output === '' ? '.' : `:\n${output}`)
  );
}

function toDisplayPath(target) {
  const relative = path.relative(REPO_ROOT, target);
  if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return target;
}

function readManifest(manifestPath, packageName) {
  let raw;

  try {
    raw = readFileSync(manifestPath, 'utf8');
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      throw new FatalError(`Package manifest is missing at ${manifestPath}.`);
    }
    throw new FatalError(`Could not read ${manifestPath}: ${error.message}`);
  }

  let manifest;

  try {
    manifest = JSON.parse(raw);
  }
  catch (error) {
    throw new FatalError(`${manifestPath} is not valid JSON: ${error.message}`);
  }

  if (manifest.name !== packageName) {
    throw new FatalError(
      `Package manifest must be named ${packageName}, found ${String(manifest.name)}.`,
    );
  }

  if (parseSemver(manifest.version) === undefined) {
    throw new FatalError(
      'Package manifest version must be a plain semver string, ' +
      `found ${String(manifest.version)}.`,
    );
  }

  return { name: manifest.name, version: manifest.version };
}

function readSpecBytes(specPath, label) {
  try {
    return readFileSync(specPath);
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      throw new FatalError(
        `${label} spec is missing at ${specPath}.` +
        (label === 'Candidate' ? ' Run `pnpm spec:generate` first.' : ''),
      );
    }
    throw new FatalError(`Could not read ${specPath}: ${error.message}`);
  }
}

function parseSpecDocument(bytes, specPath) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  }
  catch (error) {
    throw new FatalError(`${specPath} is not valid JSON: ${error.message}`);
  }
}

function makeTempDir(prefix) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  cleanupDirs.push(directory);
  return directory;
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  if (result.error !== undefined && result.error !== null) {
    if (result.error.code === 'ENOENT') {
      return false;
    }
    throw new FatalError(`Could not probe ${command}: ${result.error.message}`);
  }
  return true;
}

/**
 * GitHub release assets occasionally answer with a 5xx (the gate has seen a
 * 504) or drop the connection. Retry transient failures so an infrastructure
 * hiccup cannot block a contract change; 4xx responses still fail immediately
 * because retrying them cannot succeed.
 */
async function fetchPinnedAsset(url) {
  const attempts = 3;
  let lastDetail = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
      });

      if (response.ok) {
        return response;
      }

      lastDetail = `HTTP ${response.status}`;

      if (response.status !== 429 && response.status < 500) {
        throw new FatalError(
          `Could not download oasdiff ${OASDIFF_PINNED_VERSION} from ` +
          `${url} (HTTP ${response.status}).`,
        );
      }
    }
    catch (error) {
      if (error instanceof FatalError) {
        throw error;
      }

      lastDetail = error.message;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new FatalError(
    `Could not download oasdiff ${OASDIFF_PINNED_VERSION} from ${url} after ` +
    `${attempts} attempts (${lastDetail}).`,
  );
}

/**
 * GitHub's anonymous release-asset CDN intermittently answers 504 for the
 * pinned archive (observed in both PR and publish runs), while an
 * authenticated `gh release download` succeeds. Prefer the authenticated CLI
 * when a token is available; fall back to the plain download otherwise.
 */
function downloadPinnedAssetWithGh(directory) {
  const token = process.env.GH_TOKEN
    ?? process.env.GITHUB_TOKEN
    ?? process.env.NODE_AUTH_TOKEN;

  if (!token || !commandExists('gh')) {
    return false;
  }

  const archive = path.join(directory, OASDIFF_PINNED_ARCHIVE);
  const args = [
    'release',
    'download',
    OASDIFF_PINNED_VERSION,
    '--repo',
    'oasdiff/oasdiff',
    '--pattern',
    OASDIFF_PINNED_ARCHIVE,
    '--dir',
    directory,
    '--clobber',
  ];
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0 || !existsSync(archive)) {
    return false;
  }

  return true;
}

async function downloadPinnedOasdiff() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new FatalError(
      'No oasdiff binary found (--oasdiff, $OASDIFF_BIN, or PATH) and the ' +
      `pinned ${OASDIFF_PINNED_VERSION} release is only auto-downloaded on ` +
      `linux/amd64 (this host is ${process.platform}/${process.arch}). ` +
      'Install oasdiff locally or pass --oasdiff <path>.',
    );
  }

  const directory = makeTempDir('oasdiff-');
  const archive = path.join(directory, OASDIFF_PINNED_ARCHIVE);

  if (!downloadPinnedAssetWithGh(directory)) {
    const response = await fetchPinnedAsset(OASDIFF_PINNED_URL);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }

  const buffer = readFileSync(archive);
  const digest = createHash('sha256').update(buffer).digest('hex');

  if (digest !== OASDIFF_PINNED_SHA256) {
    throw new FatalError(
      `Checksum mismatch for ${OASDIFF_PINNED_ARCHIVE}: expected ` +
      `${OASDIFF_PINNED_SHA256}, got ${digest}.`,
    );
  }

  const extract = run('tar', ['-xzf', archive, '-C', directory]);
  if (extract.status !== 0) {
    throw new FatalError(describeFailure('tar', ['-xzf', archive, '-C', directory], extract));
  }

  const binary = path.join(directory, 'oasdiff');
  if (!existsSync(binary)) {
    throw new FatalError(
      `${OASDIFF_PINNED_ARCHIVE} did not contain an oasdiff binary.`,
    );
  }

  return binary;
}

async function resolveOasdiff(options) {
  if (options.oasdiff !== undefined) {
    if (commandExists(options.oasdiff)) {
      return options.oasdiff;
    }
    throw new FatalError(
      `--oasdiff ${options.oasdiff} is not executable. Provide a valid path ` +
      'or omit the flag to use $OASDIFF_BIN, PATH, or the pinned release.',
    );
  }

  const fromEnv = process.env.OASDIFF_BIN;
  if (fromEnv !== undefined && fromEnv !== '') {
    if (commandExists(fromEnv)) {
      return fromEnv;
    }
    throw new FatalError(
      `$OASDIFF_BIN points at ${fromEnv}, which is not executable.`,
    );
  }

  if (commandExists('oasdiff')) {
    return 'oasdiff';
  }

  return downloadPinnedOasdiff();
}

function resolveBaselineFromRegistry(options) {
  const viewArgs = [options.package, 'version', '--registry', options.registry];
  const view = run('npm', ['view', ...viewArgs]);

  if (view.status !== 0) {
    const output = `${view.stdout ?? ''}${view.stderr ?? ''}`;
    if (output.includes('E404')) {
      console.log(
        `notice: ${options.package} has never been published (E404). ` +
        'There is no baseline contract to compare against, so the check is skipped.',
      );
      return undefined;
    }
    throw new FatalError(
      `Could not resolve the last published ${options.package} version. ` +
      `Refusing to guess. npm output:\n${output.trim()}`,
    );
  }

  const version = (view.stdout ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^["']|["']$/g, ''))
    .filter((line) => line !== '')
    .pop();

  if (version === undefined || parseSemver(version) === undefined) {
    throw new FatalError(
      `npm view returned an unusable version for ${options.package}: ` +
      `${String(version)}. npm output:\n${(view.stdout ?? '').trim()}`,
    );
  }

  const directory = makeTempDir('contract-baseline-');
  const packArgs = [
    `${options.package}@${version}`,
    '--registry',
    options.registry,
    '--pack-destination',
    directory,
    '--silent',
  ];
  const pack = run('npm', ['pack', ...packArgs]);

  if (pack.status !== 0) {
    throw new FatalError(
      `Could not download ${options.package}@${version}. ` +
      describeFailure('npm', ['pack', ...packArgs], pack),
    );
  }

  const tarballs = readdirSync(directory).filter((entry) => entry.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new FatalError(
      `Expected exactly one tarball for ${options.package}@${version} in ` +
      `${directory}, found ${tarballs.length}.`,
    );
  }

  const tarball = path.join(directory, tarballs[0]);
  const untar = run('tar', ['-xzf', tarball, '-C', directory]);
  if (untar.status !== 0) {
    throw new FatalError(describeFailure('tar', ['-xzf', tarball, '-C', directory], untar));
  }

  const baselineSpecPath = path.join(directory, 'package', 'openapi.json');
  if (!existsSync(baselineSpecPath)) {
    throw new FatalError(
      `${options.package}@${version} does not ship openapi.json, so no ` +
      'baseline can be established.',
    );
  }

  const baselineManifestPath = path.join(directory, 'package', 'package.json');
  if (!existsSync(baselineManifestPath)) {
    throw new FatalError(
      `${options.package}@${version} does not ship package.json, so its ` +
      'version cannot be verified.',
    );
  }

  const baselineManifest = readManifest(baselineManifestPath, options.package);

  return {
    specPath: baselineSpecPath,
    version: baselineManifest.version,
    label: `${options.package}@${baselineManifest.version}`,
  };
}

function resolveBaseline(options) {
  if (options.baselineSpec !== undefined) {
    if (!existsSync(options.baselineSpec)) {
      throw new FatalError(
        `--baseline-spec ${options.baselineSpec} does not exist.`,
      );
    }
    return {
      specPath: options.baselineSpec,
      version: options.baselineVersion,
      label: `${options.package}@${options.baselineVersion} (local)`,
    };
  }

  return resolveBaselineFromRegistry(options);
}

function runChangelog(oasdiff, baselinePath, candidatePath) {
  const args = ['changelog', baselinePath, candidatePath, '--format', 'json'];
  const result = run(oasdiff, args);

  if (result.status !== 0) {
    throw new FatalError(
      `oasdiff could not compare the baseline with the candidate. ` +
      describeFailure(oasdiff, args, result),
    );
  }

  let entries;

  try {
    entries = JSON.parse(result.stdout ?? '');
  }
  catch (error) {
    throw new FatalError(
      `oasdiff returned unparsable JSON for ${toDisplayPath(candidatePath)}: ` +
      `${error.message}`,
    );
  }

  if (!Array.isArray(entries)) {
    throw new FatalError(
      'oasdiff returned an unexpected changelog shape (expected a JSON array).',
    );
  }

  return entries;
}

function levelOf(entry) {
  const level = Number(entry?.level);
  return Number.isFinite(level) ? level : 0;
}

function withoutDocumentation(value, parentKey) {
  if (Array.isArray(value)) {
    return value.map((item) => withoutDocumentation(item, undefined));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const result = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (DOCUMENTATION_ONLY_KEYS.has(key)) {
      continue;
    }

    if (parentKey === 'info' && key === 'version') {
      continue;
    }

    result[key] = withoutDocumentation(childValue, key);
  }

  return result;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

/** True when the documents differ in anything other than documentation. */
function hasStructuralChange(baselineDocument, candidateDocument) {
  return stableStringify(withoutDocumentation(baselineDocument, undefined))
    !== stableStringify(withoutDocumentation(candidateDocument, undefined));
}

function classify(entries, structuralChange) {
  const counts = { ERR: 0, WARN: 0, INFO: 0 };

  for (const entry of entries) {
    const name = LEVEL_NAMES.get(levelOf(entry));
    if (name !== undefined) {
      counts[name] += 1;
    }
  }

  let required = 'patch';
  if (counts.ERR > 0) {
    required = LEVEL_REQUIREMENTS.get(3);
  }
  else if (counts.WARN > 0 || structuralChange) {
    required = LEVEL_REQUIREMENTS.get(2);
  }

  return { counts, required };
}

function formatEntry(entry) {
  const level = LEVEL_NAMES.get(levelOf(entry)) ?? `L${String(entry?.level)}`;
  const text = typeof entry?.text === 'string' && entry.text !== ''
    ? entry.text
    : String(entry?.id ?? 'change');
  const operation = typeof entry?.operation === 'string' ? entry.operation : '';
  const entryPath = typeof entry?.path === 'string' ? entry.path : '';
  const location = [operation, entryPath].filter((part) => part !== '').join(' ');

  return location === '' ? `  [${level}] ${text}` : `  [${level}] ${text} (${location})`;
}

function printSummary({ baseline, candidatePath, candidateVersion, required, counts, passed }) {
  const lines = [
    passed ? 'Contract check passed.' : 'Contract check failed.',
    `  Baseline:  ${baseline.label}`,
    `  Candidate: ${candidateVersion} (${toDisplayPath(candidatePath)})`,
    `  Required bump: ${required}`,
    `  Changes: ${counts.ERR} ERR, ${counts.WARN} WARN, ${counts.INFO} INFO`,
  ];

  console.log(lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const manifestPath = path.resolve(options.manifest);
  const candidatePath = path.resolve(options.candidate);
  const manifest = readManifest(manifestPath, options.package);
  const candidateVersion = manifest.version;
  const candidateCore = parseSemver(candidateVersion);

  if (candidateCore === undefined) {
    throw new FatalError(
      `Candidate version must be a plain semver string, found ${candidateVersion}.`,
    );
  }

  const candidateBytes = readSpecBytes(candidatePath, 'Candidate');
  const baseline = resolveBaseline(options);

  if (baseline === undefined) {
    return 0;
  }

  const baselineBytes = readSpecBytes(baseline.specPath, 'Baseline');
  const baselineCore = parseSemver(baseline.version);

  if (baselineCore === undefined) {
    throw new FatalError(
      `Baseline version must be a plain semver string, found ${baseline.version}.`,
    );
  }

  if (candidateBytes.equals(baselineBytes)) {
    console.log(
      `Contract check passed: ${toDisplayPath(candidatePath)} is byte-identical ` +
      `to ${baseline.label}. No version bump required.`,
    );
    console.log(`  Candidate version: ${candidateVersion}`);
    return 0;
  }

  const oasdiff = await resolveOasdiff(options);
  const entries = runChangelog(oasdiff, baseline.specPath, candidatePath);
  const structuralChange = hasStructuralChange(
    parseSpecDocument(baselineBytes, baseline.specPath),
    parseSpecDocument(candidateBytes, candidatePath),
  );
  const { counts, required } = classify(entries, structuralChange);
  const bumpOk = satisfiesBump(required, candidateCore, baselineCore);
  const strictlyNewer = compareCore(candidateCore, baselineCore) > 0;

  if (bumpOk && strictlyNewer) {
    printSummary({
      baseline,
      candidatePath,
      candidateVersion,
      required,
      counts,
      passed: true,
    });
    return 0;
  }

  const violations = [];

  if (!bumpOk) {
    violations.push(
      `the candidate version ${candidateVersion} does not satisfy the ` +
      `required ${required} bump over the baseline ${baseline.version}.`,
    );
  }

  if (!strictlyNewer) {
    violations.push(
      `the candidate version ${candidateVersion} is not strictly greater than ` +
      `the baseline ${baseline.version}; published versions are never reused.`,
    );
  }

  printSummary({
    baseline,
    candidatePath,
    candidateVersion,
    required,
    counts,
    passed: false,
  });

  const entriesToShow = entries
    .filter((entry) => levelOf(entry) >= 2)
    .map((entry) => formatEntry(entry));

  console.log('');
  if (entriesToShow.length === 0) {
    console.log('No ERR/WARN entries were reported, yet the version rules failed.');
  }
  else {
    console.log('Offending contract changes:');
    console.log(entriesToShow.join('\n'));
  }

  console.log('');
  console.log('Violations:');
  for (const violation of violations) {
    console.log(`  - ${violation}`);
  }

  const suggested = nextVersion(required, baselineCore);
  console.log('');
  console.log('Remediation:');
  console.log(
    `  This contract change requires a ${required} bump. Set "version" in`,
  );
  console.log(`    ${manifestPath}`);
  console.log(
    `  to a ${required} version greater than ${baseline.version} ` +
    `(for example ${suggested}), then regenerate with \`pnpm spec:package\`.`,
  );
  if (counts.ERR > 0) {
    console.log(
      '  If the change was not intended, restore the removed or narrowed ' +
      'contract instead.',
    );
  }

  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    if (error instanceof UsageError) {
      console.error(`error: ${error.message}`);
      console.error('');
      console.error(USAGE);
      process.exitCode = 2;
      return;
    }

    if (error instanceof FatalError) {
      console.error(`error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error(`error: unexpected failure: ${error?.stack ?? String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const directory of cleanupDirs) {
      try {
        rmSync(directory, { recursive: true, force: true });
      }
      catch {
        // Cleanup is best effort; a leftover temp dir must not mask the result.
      }
    }
  });
