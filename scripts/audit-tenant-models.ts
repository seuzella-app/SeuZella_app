import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const matrixPath = path.join(root, 'docs', 'TENANT_ISOLATION_MATRIX.md');
const runtimePath = path.join(root, 'src', 'lib', 'db', 'tenant-prisma.ts');

function read(file: string): string {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

const schema = read(schemaPath);
const matrix = read(matrixPath);
const runtime = read(runtimePath);

const models = new Map<string, { hasTenantId: boolean; optionalTenantId: boolean }>();
const blocks = schema.split(/\n(?=model\s+)/g).filter(block => /^model\s+\w+\s*\{/m.test(block));
for (const block of blocks) {
  const header = block.match(/^model\s+(\w+)\s*\{/m);
  if (!header) continue;
  const name = header[1];
  const tenant = block.match(/^\s*tenantId\s+String(\?)?/m);
  models.set(name, {
    hasTenantId: Boolean(tenant),
    optionalTenantId: Boolean(tenant?.[1]),
  });
}

const matrixRows = [...matrix.matchAll(/^\|\s*([A-Za-z0-9_]+)\s*\|\s*([^|]+)\|/gm)]
  .map(m => ({ name: m[1], classification: m[2].trim() }))
  .filter(row => !['Modelo', '---'].includes(row.name));

const matrixNames = new Set(matrixRows.map(row => row.name));
const duplicates = matrixRows.filter((row, i) => matrixRows.findIndex(x => x.name === row.name) !== i);

const runtimeSection = runtime.match(/const TENANT_MODELS = \[(.*?)\] as const;/s)?.[1] ?? '';
const runtimeNames = [...runtimeSection.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
const runtimeSet = new Set(runtimeNames);

const schemaTenantModels = [...models.entries()]
  .filter(([, info]) => info.hasTenantId)
  .map(([name]) => name)
  .sort();
const schemaTenantSet = new Set(schemaTenantModels);

const matrixMissingFromSchema = [...matrixNames].filter(name => !models.has(name)).sort();
const schemaMissingFromMatrix = schemaTenantModels.filter(name => !matrixNames.has(name));
const scopedMissingRuntime = matrixRows
  .filter(row => row.classification.toUpperCase() === 'TENANT_SCOPED')
  .map(row => row.name)
  .filter(name => !runtimeSet.has(name));
const nonTenantInRuntime = runtimeNames.filter(name => !schemaTenantSet.has(name));

console.log(`Schema models: ${models.size}`);
console.log(`Schema models with tenantId (required or optional): ${schemaTenantModels.length}`);
console.log(`Matrix rows: ${matrixRows.length}`);
console.log(`Runtime TENANT_MODELS: ${runtimeNames.length}`);
console.log(`Duplicate matrix rows: ${duplicates.length}`);

if (matrixMissingFromSchema.length) console.error('Matrix models absent from schema:', matrixMissingFromSchema);
if (schemaMissingFromMatrix.length) console.error('Schema tenantId models absent from matrix:', schemaMissingFromMatrix);
if (scopedMissingRuntime.length) console.error('TENANT_SCOPED models absent from runtime list:', scopedMissingRuntime);
if (nonTenantInRuntime.length) console.error('Runtime list contains models without tenantId:', nonTenantInRuntime);

const failed = matrixMissingFromSchema.length || schemaMissingFromMatrix.length || duplicates.length || scopedMissingRuntime.length || nonTenantInRuntime.length;
if (failed) process.exit(1);
console.log('TENANT ISOLATION AUDIT: PASS');
