/**
 * Script de Inventário Profundo de 50 Pontos — Fase 0
 * Varre o repositório inteiro e mapeia todas as dimensões do sistema.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === '.gemini') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = walk(ROOT).map(f => path.relative(ROOT, f));

// 1. Directory Structure
const dirs = Array.from(new Set(allFiles.map(f => path.dirname(f)))).sort();

// 2. Package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// 8. Prisma Schema
const schemaPath = path.join(ROOT, 'prisma', 'schema.prisma');
const schemaContent = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
const models = (schemaContent.match(/^model\s+(\w+)/gm) || []).map(m => m.replace(/^model\s+/, ''));
const enums = (schemaContent.match(/^enum\s+(\w+)/gm) || []).map(e => e.replace(/^enum\s+/, ''));

// 10. API routes
const apiRoutes = allFiles.filter(f => f.startsWith('src/app/api/') && f.endsWith('route.ts'));

// 13. Cron Jobs
const cronRoutes = apiRoutes.filter(r => r.includes('/api/cron/'));

// 14. Webhooks
const webhookRoutes = apiRoutes.filter(r => r.includes('/api/webhooks/'));

// 31. Workflows
const workflowFiles = allFiles.filter(f => f.startsWith('.github/workflows/') && (f.endsWith('.yml') || f.endsWith('.yaml')));

// 32. Tests
const testFiles = allFiles.filter(f => (f.startsWith('tests/') || f.startsWith('src/__tests__/')) && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')));

// Scan content for items 36-50
const findings = {
  demoAccounts: [],
  bypassAuth: [],
  hardcodedCredentials: [],
  localhostRefs: [],
  publicIps: [],
  todos: 0,
  anyCasts: 0,
  suppressedErrors: 0,
  eslintDisable: 0,
  tsIgnore: 0,
  emptyCatch: 0,
  consoleLogs: 0,
  sqliteRefs: [],
  bunRefs: [],
  dbPushAcceptDataLoss: []
};

for (const relFile of allFiles) {
  if (relFile.endsWith('.png') || relFile.endsWith('.jpg') || relFile.endsWith('.webp') || relFile.endsWith('.mp3') || relFile.endsWith('.ico') || relFile.endsWith('.pdf') || relFile.endsWith('.lock') || relFile.endsWith('.jsonl') || relFile.endsWith('.md')) continue;
  
  const absPath = path.join(ROOT, relFile);
  const content = fs.readFileSync(absPath, 'utf8');

  if (content.includes('123/123') || content.includes('Demo@123') || content.includes('demo@zella') || content.includes('pousada@zehla') || content.includes('airbnb@zehla')) {
    findings.demoAccounts.push(relFile);
  }
  if (content.includes('BYPASS_MIDDLEWARE_AUTH')) {
    findings.bypassAuth.push(relFile);
  }
  if (content.includes('file:./') || content.includes('sqlite')) {
    findings.sqliteRefs.push(relFile);
  }
  if (content.includes('bun ') || content.includes('bun.') || content.includes('bun ')) {
    findings.bunRefs.push(relFile);
  }
  if (content.includes('db push --accept-data-loss')) {
    findings.dbPushAcceptDataLoss.push(relFile);
  }
  if (content.includes('21.0.13.26')) {
    findings.publicIps.push(relFile);
  }

  findings.anyCasts += (content.match(/:\s*any\b|as\s+any\b/g) || []).length;
  findings.tsIgnore += (content.match(/@ts-ignore|@ts-nocheck/g) || []).length;
  findings.eslintDisable += (content.match(/eslint-disable/g) || []).length;
  findings.todos += (content.match(/\b(TODO|FIXME|HACK)\b/g) || []).length;
  findings.consoleLogs += (content.match(/console\.(log|info|debug)\(/g) || []).length;
  findings.emptyCatch += (content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
}

const report = {
  timestamp: new Date().toISOString(),
  totalFiles: allFiles.length,
  directoriesCount: dirs.length,
  packageDetails: {
    name: pkg.name,
    version: pkg.version,
    nextVersion: pkg.dependencies?.next || pkg.devDependencies?.next,
    reactVersion: pkg.dependencies?.react || pkg.devDependencies?.react,
    prismaVersion: pkg.dependencies?.['@prisma/client'] || pkg.devDependencies?.prisma,
    typescriptVersion: pkg.devDependencies?.typescript
  },
  prismaStats: {
    modelsCount: models.length,
    enumsCount: enums.length,
    modelsList: models
  },
  apiRoutesCount: apiRoutes.length,
  apiRoutes: apiRoutes,
  cronJobsCount: cronRoutes.length,
  cronJobs: cronRoutes,
  webhooksCount: webhookRoutes.length,
  webhooks: webhookRoutes,
  workflowsCount: workflowFiles.length,
  workflowFiles: workflowFiles,
  testsCount: testFiles.length,
  testFiles: testFiles,
  findings: findings
};

fs.writeFileSync(path.join(ROOT, 'inventory-50-points.json'), JSON.stringify(report, null, 2));
console.log('✅ Inventory Completed! Summary:');
console.log(`- Total Files: ${report.totalFiles}`);
console.log(`- API Routes: ${report.apiRoutesCount}`);
console.log(`- Workflows: ${report.workflowsCount}`);
console.log(`- Test Files: ${report.testsCount}`);
console.log(`- Prisma Models: ${report.prismaStats.modelsCount}`);
console.log(`- SQLite References: ${report.findings.sqliteRefs.length}`);
console.log(`- Bun References: ${report.findings.bunRefs.length}`);
console.log(`- db push --accept-data-loss occurrences: ${report.findings.dbPushAcceptDataLoss.length}`);
