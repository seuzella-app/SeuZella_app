import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SecLists JSONs existem e são válidos', () => {
  const dir = path.resolve(process.cwd(), 'public/data/seclists');

  it('jailbreak-prompts.json existe e tem >1000 prompts', () => {
    const raw = fs.readFileSync(path.join(dir, 'jailbreak-prompts.json'), 'utf-8');
    const arr = JSON.parse(raw);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(1000);
  });

  it('sast-patterns.json existe e tem >100 patterns', () => {
    const raw = fs.readFileSync(path.join(dir, 'sast-patterns.json'), 'utf-8');
    const arr = JSON.parse(raw);
    expect(arr.length).toBeGreaterThan(100);
    expect(arr).toContain('api_key');
  });

  it('malicious-functions.json existe e tem >50 functions', () => {
    const raw = fs.readFileSync(path.join(dir, 'malicious-functions.json'), 'utf-8');
    const arr = JSON.parse(raw);
    expect(arr.length).toBeGreaterThan(50);
    expect(arr).toContain('eval');
  });

  it('common-passwords.json existe e tem >5000 passwords', () => {
    const raw = fs.readFileSync(path.join(dir, 'common-passwords.json'), 'utf-8');
    const arr = JSON.parse(raw);
    expect(arr.length).toBeGreaterThan(5000);
    expect(arr).toContain('123456');
  });

  it('cmd-injection.json existe e tem >100 payloads', () => {
    const raw = fs.readFileSync(path.join(dir, 'cmd-injection.json'), 'utf-8');
    const arr = JSON.parse(raw);
    expect(arr.length).toBeGreaterThan(100);
  });

  it('seclists-loader.ts existe', () => {
    const p = path.resolve(process.cwd(), 'src/lib/security/seclists-loader.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('seclists-loader.ts exporta funções esperadas', () => {
    const p = path.resolve(process.cwd(), 'src/lib/security/seclists-loader.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('loadJailbreakPrompts');
    expect(content).toContain('loadSastPatterns');
    expect(content).toContain('loadMaliciousFunctions');
    expect(content).toContain('loadCommonPasswords');
    expect(content).toContain('loadCmdInjectionPayloads');
    expect(content).toContain('detectJailbreak');
    expect(content).toContain('isCommonPassword');
    expect(content).toContain('scanCodeWithSecLists');
    expect(content).toContain('getSecListsStats');
  });
});
