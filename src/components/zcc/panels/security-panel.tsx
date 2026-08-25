'use client';

// @ts-nocheck — ZCC visual panel
import * as React from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Bug, Lock, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SecurityFinding {
  id: string;
  scanType: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: string;
  file?: string;
  line?: number;
  cwe?: string;
  remediation?: string;
  scannedAt: string;
}

interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  fixed: number;
  falsePositive: number;
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const SEVERITY_ICONS = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: Bug,
  low: Lock,
  info: Shield,
};

const SCAN_TYPE_LABELS = {
  sast: 'SAST (GLM 5.2)',
  pentest: 'Pentest (GLM 5.2)',
  'secret-scan': 'Secret Scan (Regex)',
  dependency: 'Dependency',
};

export function SecurityPanel() {
  const [findings, setFindings] = React.useState<SecurityFinding[]>([]);
  const [summary, setSummary] = React.useState<ScanSummary | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [lastScan, setLastScan] = React.useState<string | null>(null);

  const fetchFindings = React.useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/security', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setFindings(data.findings || []);
      setSummary(data.summary || null);
    } catch {
      // silent
    }
  }, []);

  React.useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/zcc/security', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
        setSummary(data.summary || null);
        setLastScan(data.timestamp);
      }
    } catch {
      // silent
    } finally {
      setScanning(false);
    }
  };

  const sevIcon = (sev: string) => {
    const Icon = (SEVERITY_ICONS as Record<string, any>)[sev] || Shield;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            Central de Segurança
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            codex-security + T3MP3ST | GLM 5.2 | Scan automático 03:00 BRT
          </p>
        </div>
        <Button
          onClick={runScan}
          disabled={scanning}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {scanning ? (
            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Escaneando...</>
          ) : (
            <><Zap className="mr-2 h-4 w-4" /> Escanear Agora</>
          )}
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-2xl font-bold text-red-400">{summary.critical}</p>
                  <p className="text-[10px] text-zinc-500">Críticas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-orange-400">{summary.high}</p>
                  <p className="text-[10px] text-zinc-500">Altas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-amber-400">{summary.medium}</p>
                  <p className="text-[10px] text-zinc-500">Médias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{summary.fixed}</p>
                  <p className="text-[10px] text-zinc-500">Corrigidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last scan info */}
      {lastScan && (
        <p className="text-xs text-zinc-500">
          Último scan: {new Date(lastScan).toLocaleString('pt-BR')}
        </p>
      )}

      {/* Findings list */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-300">Findings Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <ShieldCheck className="h-12 w-12 mb-2 text-emerald-400/50" />
              <p className="text-sm">Nenhum finding. Execute um scan.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {findings.map((finding) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border ${SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.info}`}
                  >
                    <div className="flex items-start gap-2">
                      {sevIcon(finding.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold truncate">{finding.title}</p>
                          <Badge variant="outline" className="text-[9px] h-4">
                            {(SCAN_TYPE_LABELS as Record<string, string>)[finding.scanType] || finding.scanType}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{finding.description}</p>
                        {finding.file && (
                          <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                            {finding.file}{finding.line ? `:${finding.line}` : ''}
                            {finding.cwe ? ` | ${finding.cwe}` : ''}
                          </p>
                        )}
                        {finding.remediation && (
                          <p className="text-[10px] text-emerald-400/70 mt-1">
                            Fix: {finding.remediation}
                          </p>
                        )}
                      </div>
                      <Badge className="text-[9px] capitalize">{finding.status}</Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Tools info */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <p className="text-sm font-semibold text-zinc-300">codex-security</p>
            </div>
            <p className="text-[10px] text-zinc-500">
              SAST semântico via GLM 5.2. Analisa código-fonte em busca de
              injection, IDOR, auth bypass, tenant isolation gaps.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-purple-400" />
              <p className="text-sm font-semibold text-zinc-300">T3MP3ST</p>
            </div>
            <p className="text-[10px] text-zinc-500">
              Pentest black-box via GLM 5.2. Gera payloads de ataque e
              valida exploração HTTP real (recon → exploit → report).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-fix notice */}
      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <p className="text-xs text-emerald-400">
            <strong>Auto-Fix ZéCode:</strong> Findings críticos/altos disparam
            alerta para o ZéCode, que usa GLM 5.2 para gerar patches em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
