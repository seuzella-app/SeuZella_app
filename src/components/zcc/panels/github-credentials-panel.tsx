'use client';

/**
 * GitHub Credentials Panel — Admin UI para gerenciar PATs/GitHub Apps.
 *
 * Funcionalidades:
 *  - Listar credenciais ativas (com indicador de expiração)
 *  - Adicionar nova credencial (form com validação)
 *  - Validar PAT antes de salvar (chama /user e /repos)
 *  - Rotacionar credencial (zero-downtime)
 *  - Revogação emergencial
 *  - Visualizar audit log (filtros + paginação)
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 4)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, KeyRound, AlertTriangle, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

interface CredentialInfo {
  id: string;
  label: string;
  authType: 'fine_grained_pat' | 'github_app' | 'deploy_key';
  scopes: string[];
  repositoryAccess: string[];
  isActive: boolean;
  expiresAt: string;
  lastUsedAt: string | null;
  lastValidatedAt: string | null;
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface AuditLog {
  id: string;
  credentialId: string;
  action: string;
  apiEndpoint: string | null;
  apiMethod: string | null;
  repository: string | null;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  durationMs: number | null;
  createdAt: string;
  credential?: { label: string; authType: string };
}

export function GitHubCredentialsPanel() {
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credentials');

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/zcc/github/credentials');
      if (!res.ok) throw new Error('Falha ao carregar credenciais');
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleRevoke = async (id: string, label: string) => {
    const reason = prompt(
      `Revogar "${label}"?\n\nMotivo (obrigatório para audit log):`
    );
    if (!reason) return;

    try {
      const res = await fetch(`/api/zcc/github/credentials/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao revogar');
      }
      alert(
        'Credencial revogada no Vault.\n\nURGENTE: revogue também no GitHub:\nhttps://github.com/settings/tokens'
      );
      fetchCredentials();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              GitHub Credentials — PAT Vault
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchCredentials}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
              <AddCredentialDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onCreated={fetchCredentials}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma credencial GitHub cadastrada.</p>
              <p className="text-sm mt-1">
                Clique em "Adicionar Credencial" para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <CredentialCard
                  key={cred.id}
                  credential={cred}
                  onRevoke={() => handleRevoke(cred.id, cred.label)}
                  onRotated={fetchCredentials}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="credentials">Credenciais</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="credentials">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Lista de credenciais exibida acima. Use os botões em cada card para
                rotacionar ou revogar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// CREDENTIAL CARD
// ============================================================

function CredentialCard({
  credential,
  onRevoke,
  onRotated,
}: {
  credential: CredentialInfo;
  onRevoke: () => void;
  onRotated: () => void;
}) {
  const [rotateOpen, setRotateOpen] = useState(false);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{credential.label}</h3>
            <Badge variant={credential.authType === 'github_app' ? 'default' : 'secondary'}>
              {credential.authType === 'fine_grained_pat' && 'PAT Fine-Grained'}
              {credential.authType === 'github_app' && 'GitHub App'}
              {credential.authType === 'deploy_key' && 'Deploy Key'}
            </Badge>
            {credential.isExpired && (
              <Badge variant="destructive">EXPIRADO</Badge>
            )}
            {credential.isExpiringSoon && !credential.isExpired && (
              <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                Expira em {credential.daysUntilExpiry}d
              </Badge>
            )}
            {!credential.isExpiringSoon && !credential.isExpired && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {credential.daysUntilExpiry}d restantes
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Expira em: {new Date(credential.expiresAt).toLocaleDateString('pt-BR')}
            {credential.lastUsedAt && (
              <> · Último uso: {new Date(credential.lastUsedAt).toLocaleString('pt-BR')}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <RotateDialog
            credentialId={credential.id}
            label={credential.label}
            open={rotateOpen}
            onOpenChange={setRotateOpen}
            onRotated={onRotated}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={onRevoke}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Revogar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-medium mb-1">Scopes:</p>
          <div className="flex flex-wrap gap-1">
            {credential.scopes.length === 0 ? (
              <span className="text-muted-foreground">Nenhum</span>
            ) : (
              credential.scopes.map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="font-medium mb-1">Repos:</p>
          <div className="flex flex-wrap gap-1">
            {credential.repositoryAccess.length === 0 ? (
              <span className="text-muted-foreground">Todos (perigo!)</span>
            ) : (
              credential.repositoryAccess.map((r) => (
                <Badge key={r} variant="outline" className="text-xs">
                  {r}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADD CREDENTIAL DIALOG
// ============================================================

function AddCredentialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [authType, setAuthType] = useState<'fine_grained_pat' | 'github_app' | 'deploy_key'>('fine_grained_pat');
  const [pat, setPat] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scopes, setScopes] = useState<string[]>([
    'contents:write',
    'pull_requests:write',
    'issues:write',
    'workflows:read',
    'metadata:read',
  ]);
  const [repositoryAccess, setRepositoryAccess] = useState('MarcioCau14/SmartHotel_Zehla');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    setValidationResult(null);
    try {
      const res = await fetch('/api/zcc/github/credentials/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pat,
          repo: repositoryAccess.split(',')[0].trim(),
        }),
      });
      const data = await res.json();
      setValidationResult(data);
      if (!data.valid) {
        setError('PAT inválido');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/zcc/github/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          authType,
          pat,
          expiresAt,
          scopes,
          repositoryAccess: repositoryAccess.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');
      onOpenChange(false);
      onCreated();
      // Reset
      setLabel('');
      setPat('');
      setExpiresAt('');
      setValidationResult(null);
      alert(`Credencial criada com sucesso! ID: ${data.credentialId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const availableScopes = [
    { value: 'contents:write', label: 'Contents: Read & Write (commits)', recommended: true },
    { value: 'pull_requests:write', label: 'Pull Requests: Read & Write', recommended: true },
    { value: 'issues:write', label: 'Issues: Read & Write', recommended: true },
    { value: 'workflows:read', label: 'Workflows: Read-only', recommended: true },
    { value: 'metadata:read', label: 'Metadata: Read (obrigatório)', recommended: true },
    { value: 'checks:read', label: 'Checks: Read (status CI)' },
    { value: 'commit_signatures:read', label: 'Commit Signatures: Read' },
    { value: 'dependabot_alerts:read', label: 'Dependabot Alerts: Read' },
    { value: 'secret_scanning_alerts:read', label: 'Secret Scanning: Read' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <KeyRound className="h-4 w-4 mr-1" /> Adicionar Credencial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Credencial GitHub</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="label">Label (identificador único)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: prod-corporate"
              />
            </div>
            <div>
              <Label htmlFor="authType">Tipo</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fine_grained_pat">PAT Fine-Grained (recomendado)</SelectItem>
                  <SelectItem value="github_app">GitHub App (gold standard)</SelectItem>
                  <SelectItem value="deploy_key">Deploy Key (apenas clone/push)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pat">
              {authType === 'fine_grained_pat' && 'PAT Fine-Grained (github_pat_xxx...)'}
              {authType === 'github_app' && 'GitHub App Private Key (.pem)'}
              {authType === 'deploy_key' && 'SSH Private Key'}
            </Label>
            <Textarea
              id="pat"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              rows={authType === 'fine_grained_pat' ? 2 : 6}
              placeholder={
                authType === 'fine_grained_pat'
                  ? 'github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                  : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
              }
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiresAt">Expira em (max 90 dias recomendado)</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="repoAccess">Repositórios (separados por vírgula)</Label>
              <Input
                id="repoAccess"
                value={repositoryAccess}
                onChange={(e) => setRepositoryAccess(e.target.value)}
                placeholder="owner/repo1, owner/repo2"
              />
            </div>
          </div>

          <div>
            <Label>Scopes (permissões)</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {availableScopes.map((scope) => (
                <div key={scope.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={scope.value}
                    checked={scopes.includes(scope.value)}
                    onCheckedChange={() => toggleScope(scope.value)}
                  />
                  <Label htmlFor={scope.value} className="text-sm font-normal">
                    {scope.label}
                    {scope.recommended && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        recomendado
                      </Badge>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {validationResult && (
            <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
              {validationResult.valid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {validationResult.valid ? (
                  <>
                    <strong>PAT válido!</strong> Login: <code>{validationResult.login}</code>
                    {validationResult.hasRepoAccess !== undefined && (
                      <>
                        {' · Acesso ao repo: '}
                        {validationResult.hasRepoAccess ? '✅' : '❌'}
                      </>
                    )}
                    {' · Rate limit: '}
                    {validationResult.rateLimit.remaining}/{validationResult.rateLimit.limit}
                  </>
                ) : (
                  'PAT inválido ou expirado'
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleValidate} disabled={validating || !pat}>
              {validating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Validar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !label || !pat || !expiresAt}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Salvar Credencial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ROTATE DIALOG
// ============================================================

function RotateDialog({
  credentialId,
  label,
  open,
  onOpenChange,
  onRotated,
}: {
  credentialId: string;
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRotated: () => void;
}) {
  const [newPat, setNewPat] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRotate = async () => {
    setRotating(true);
    setError(null);
    try {
      const res = await fetch(`/api/zcc/github/credentials/${credentialId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPat, newExpiresAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onOpenChange(false);
      onRotated();
      setNewPat('');
      setNewExpiresAt('');
      alert(
        'Rotação concluída!\n\nATENÇÃO: revogue o PAT antigo manualmente em:\nhttps://github.com/settings/tokens'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRotating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" /> Rotacionar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotacionar Credencial: {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Rotação zero-downtime: cria novo registro, marca antigo como inativo.
              Você ainda precisa revogar o PAT antigo manualmente no GitHub.
            </AlertDescription>
          </Alert>
          <div>
            <Label htmlFor="newPat">Novo PAT (github_pat_xxx...)</Label>
            <Textarea
              id="newPat"
              value={newPat}
              onChange={(e) => setNewPat(e.target.value)}
              rows={2}
              className="font-mono text-xs"
              placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div>
            <Label htmlFor="newExpires">Nova data de expiração</Label>
            <Input
              id="newExpires"
              type="date"
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRotate} disabled={rotating || !newPat || !newExpiresAt}>
            {rotating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Confirmar Rotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// AUDIT LOG PANEL
// ============================================================

function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', success: '' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.action) params.set('action', filter.action);
      if (filter.success) params.set('success', filter.success);
      params.set('limit', '50');
      const res = await fetch(`/api/zcc/github/credentials/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4 mb-4">
          <Select value={filter.action} onValueChange={(v) => setFilter({ ...filter, action: v })}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas as ações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as ações</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="VALIDATE">VALIDATE</SelectItem>
              <SelectItem value="READ">READ</SelectItem>
              <SelectItem value="API_CALL">API_CALL</SelectItem>
              <SelectItem value="ROTATE">ROTATE</SelectItem>
              <SelectItem value="REVOKE">REVOKE</SelectItem>
              <SelectItem value="EXPIRE_ALERT">EXPIRE_ALERT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.success} onValueChange={(v) => setFilter({ ...filter, success: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos status</SelectItem>
              <SelectItem value="true">Sucesso</SelectItem>
              <SelectItem value="false">Falha</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum log encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`border-l-4 p-2 text-xs ${
                  log.success
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {log.action}
                    {log.credential && (
                      <span className="text-muted-foreground"> · {log.credential.label}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                {log.apiMethod && log.apiEndpoint && (
                  <div className="font-mono text-xs mt-1">
                    {log.apiMethod} {log.apiEndpoint}
                    {log.statusCode && ` → ${log.statusCode}`}
                    {log.durationMs !== null && ` (${log.durationMs}ms)`}
                  </div>
                )}
                {log.errorMessage && (
                  <div className="mt-1 text-red-700">{log.errorMessage}</div>
                )}
                {log.repository && (
                  <div className="text-muted-foreground">repo: {log.repository}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
