import fs from "node:fs";
import path from "node:path";

const desktopDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(desktopDir, "../..");
const apiDir = path.join(repoRoot, "apps", "api");
const sharedDir = path.join(repoRoot, "packages", "shared");
const outApiDir = path.join(desktopDir, "build-resources", "api");
const outNodeModules = path.join(outApiDir, "node_modules");

fs.rmSync(outApiDir, { recursive: true, force: true });
fs.mkdirSync(outNodeModules, { recursive: true });

// 1. Copy compiled API and Prisma schema/migrations
fs.cpSync(path.join(apiDir, "dist"), path.join(outApiDir, "dist"), {
  recursive: true,
  dereference: true,
});
fs.cpSync(path.join(apiDir, "prisma"), path.join(outApiDir, "prisma"), {
  recursive: true,
  dereference: true,
});

// 2. Write standalone package.json for ESM runtime
fs.writeFileSync(
  path.join(outApiDir, "package.json"),
  JSON.stringify(
    {
      name: "@finflow/api-runtime",
      version: "1.0.0",
      private: true,
      type: "module",
    },
    null,
    2
  ) + "\n",
  "utf8"
);

// 3. Copy @finflow/shared
const outSharedDir = path.join(outNodeModules, "@finflow", "shared");
fs.mkdirSync(outSharedDir, { recursive: true });
fs.cpSync(path.join(sharedDir, "package.json"), path.join(outSharedDir, "package.json"), {
  dereference: true,
});
fs.cpSync(path.join(sharedDir, "dist"), path.join(outSharedDir, "dist"), {
  recursive: true,
  dereference: true,
});

// 4. Copy .prisma generated client + query engine
const searchRoots = [
  path.join(apiDir, "node_modules"),
  path.join(sharedDir, "node_modules"),
  path.join(repoRoot, "node_modules"),
];

for (const root of searchRoots) {
  const dotPrisma = path.join(root, ".prisma");
  if (fs.existsSync(dotPrisma)) {
    fs.cpSync(dotPrisma, path.join(outNodeModules, ".prisma"), {
      recursive: true,
      dereference: true,
    });
    break;
  }
}

// 5. Recursively copy production dependencies
const visited = new Set(["@finflow/shared"]);

function findPackageDir(pkgName) {
  for (const root of searchRoots) {
    const candidate = path.join(root, ...pkgName.split("/"));
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return null;
}

function collectDeps(pkgJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  return {
    ...pkg.optionalDependencies,
    ...pkg.dependencies,
  };
}

const SKIP_DIRS = new Set([
  "test",
  "tests",
  "__tests__",
  "example",
  "examples",
  "benchmarks",
  ".github",
  ".git",
  "coverage",
]);

function copyFilter(src) {
  const base = path.basename(src);
  if (SKIP_DIRS.has(base)) {
    try {
      if (fs.statSync(src).isDirectory()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function copyPackageTree(pkgName) {
  if (visited.has(pkgName)) return;
  visited.add(pkgName);

  const srcDir = findPackageDir(pkgName);
  if (!srcDir) return;

  const destDir = path.join(outNodeModules, ...pkgName.split("/"));
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    dereference: true,
    filter: copyFilter,
  });

  const deps = collectDeps(path.join(srcDir, "package.json"));
  for (const depName of Object.keys(deps)) {
    copyPackageTree(depName);
  }
}

for (const entryPkgJson of [
  path.join(apiDir, "package.json"),
  path.join(sharedDir, "package.json"),
]) {
  const deps = collectDeps(entryPkgJson);
  for (const depName of Object.keys(deps)) {
    copyPackageTree(depName);
  }
}

console.log(`Prepared self-contained API bundle at ${outApiDir} (${visited.size} packages).`);
