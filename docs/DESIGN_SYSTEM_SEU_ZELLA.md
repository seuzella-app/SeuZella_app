# DESIGN SYSTEM OFICIAL — SEU ZÉLLA
### Sistema de Design, Tokens Visuais, Identidade e Padrões de Interface (UI/UX)

---

## 1. Identidade & Filosofia Visual da Marca

O **Seu Zélla** une a sofisticação da tecnologia de ponta (*AI-first & Smart Locks*) com a hospitalidade acolhedora e calorosa do setor de pousadas e anfitriões.

- **Vibe:** Tecnológico, Seguro, Acolhedor, Ultra-Rápido e 100% Operacional.
- **Tom Visual:** *Dark Mode Premium* (Obsidian / Grafite Profundo), com gradientes sutis e realces vibrantes em **Verde Esmeralda Operacional** (`#10b981`) e **Ciano Inteligência** (`#06b6d4`).
- **Foco de UX:** 0% de atrito para o hóspede no WhatsApp e 100% de clareza em 1 olhar para o proprietário nos DDCs Mobile e Desktop.

---

## 2. Paleta de Cores & Design Tokens (Tailwind & CSS Variables)

```css
:root {
  /* Superfícies & Fundos */
  --bg-obsidian: #09090f;
  --bg-card-primary: #12121a;
  --bg-card-secondary: #181826;
  --bg-card-elevated: #1f1f30;
  
  /* Linhas & Bordas Glassmorphism */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-high-contrast: #27273a;
  --border-active-emerald: #10b981;
  
  /* Cores de Ação & Status Operacional */
  --emerald-operational: #10b981;
  --emerald-operational-glow: rgba(16, 185, 129, 0.25);
  --cyan-intelligence: #06b6d4;
  --amber-attention: #f59e0b;
  --rose-alert: #f43f5e;
  --purple-ai: #8b5cf6;
  
  /* Tipografia & Contrastes */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
}
```

### Mapa de Aplicação das Cores:

| Token | Hex / Valor | Significado no Seu Zélla |
| :--- | :---: | :--- |
| **Obsidian Background** | `#09090f` | Fundo imersivo padrão de todas as telas (DDC, ZCC e Landing) |
| **Card Charcoal** | `#12121a` | Superfície principal de cards com `rounded-3xl` e sombra profunda |
| **Emerald Operacional** | `#10b981` | Status "100% OPERACIONAL", confirmação de PIX (Asaas/MP), fechadura destravada |
| **Cyan Pulse** | `#06b6d4` | Indicador do Cérebro Zélla ativo, sincronização realtime SSE e iCal |
| **Amber Attention** | `#f59e0b` | Alerta de bateria fraca de fechadura (<20%) e check-out pendente |
| **Rose Alert** | `#f43f5e` | Revogação de pânico (Panic Revoke), erro em cartão ou tentativa inválida |
| **Purple AI** | `#8b5cf6` | ZéCode, Zaos NeuroRouter e módulos de automação inteligente |

---

## 3. Tipografia & Escala de Leitura

- **Família Tipográfica:** `Inter`, `Geist Sans`, `Outfit` ou fontes nativas do sistema (`system-ui`).
- **Hospitality 140% Readability:** Textos e números críticos (ex: PIN da fechadura, valor do PIX e quarto) utilizam fonte em escala ampliada com alto contraste para leitura rápida em ambientes ensolarados ou no celular em movimento.
- **Hierarquia:**
  - **Hero Title:** `text-2xl font-black tracking-tight text-white`
  - **Section Headers:** `text-xs font-bold uppercase tracking-wider text-emerald-400`
  - **KPIs / Métricas:** `text-3xl font-black tabular-nums text-white`
  - **PIN Display:** `font-mono text-xl font-bold tracking-widest text-emerald-300`
  - **Body / Labels:** `text-xs text-zinc-400 font-medium`

---

## 4. Padrões de Componentes (UI Patterns)

### 4.1 Card Padrão DDC (`rounded-3xl` + Glassmorphism)
```tsx
<div className="rounded-3xl border border-zinc-800/80 bg-[#12121a]/95 p-5 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
  {/* Conteúdo do Card */}
</div>
```

### 4.2 Selo de Integridade "100% OPERACIONAL"
```tsx
<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
  </span>
  100% OPERACIONAL
</div>
```

### 4.3 Botão de Ação de Alta Conversão (PIX Instantâneo / Asaas / Mercado Pago)
```tsx
<button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 px-4 font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
  <CheckCircle2 className="h-5 w-5" />
  Pagar com PIX 1-Clique
</button>
```

### 4.4 Card de Quarto & Fechadura Inteligente
- Exibe o número/nome do quarto.
- Indicador de status (Livre em verde, Ocupado em azul, Manutenção em âmbar).
- Indicador de bateria com ícone e alerta pulsante para pilhas < 20%.
- Botão "Destravar" com acionamento seguro e feedback tátil/visual imediato.

---

## 5. Viewports & Responsividade

- **Mobile First:** Projetado nativamente para o viewport de 390x844 (iPhone 15 e smartphones modernos), sem cortes, com scroll suave e área de toque (*touch targets*) de no mínimo 48x48px.
- **Desktop & iPad:** Adaptação para grid multicolunas com visão panorâmica de todos os quartos e controle da operação em uma única tela.

---

> **Design System Oficial — Seu Zélla**  
> *Criado para velocidade, elegância e operação hoteleira autônoma.*
