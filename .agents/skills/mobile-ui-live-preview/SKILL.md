---
name: mobile-ui-live-preview
description: Loop autônomo de desenvolvimento e verificação visual mobile (390x844 iPhone 15) com Browser Agent, Hot Reload e análise visual contínua no Antigravity IDE.
---

# MOBILE UI LIVE PREVIEW & VISUAL LOOP

Este skill define o protocolo rigoroso de desenvolvimento **Mobile-First com Loop Visual Contínuo** para o projeto Seu Zélla / SmartHotel.

## 🔄 PROTOCOLO DO VISUAL LOOP (CODE → BROWSER → CHECK → FIX)

Sempre que a tarefa envolver ajuste de UI, responsividade ou telas mobile:

```
┌─────────────────────────────────────────────────────────┐
│                     UI VISUAL LOOP                      │
├─────────────────────────────────────────────────────────┤
│ 1. CODE EDIT       │ Modifica componentes/CSS           │
│ 2. HOT RELOAD      │ Aguarda recompilação (local/vercel)│
│ 3. BROWSER PREVIEW │ Abre no Browser Agent (390 x 844)  │
│ 4. VISUAL CHECK    │ Inspeciona layout, bounds e touch  │
│ 5. AUTONOMOUS FIX  │ Corrige se houver estouro/quebra   │
└─────────────────────────────────────────────────────────┘
```

## 📐 REGRAS DE OURO DO LAYOUT MOBILE

1. **Viewport de Referência**: `390 x 844 px` (iPhone 15 / Modern Smartphones).
2. **Zero Overflow Horizontal**: Proibido `overflow-x-auto` ou barra de rolagem horizontal em páginas de celular. Todo conteúdo deve fluir verticalmente em `space-y-*` ou `flex-col`.
3. **Área de Toque (Thumb Zone)**: Todos os botões e elementos clicáveis DEVEM possuir altura mínima de `min-h-[44px]` e largura mínima de `min-w-[44px]`.
4. **Cards Responsivos Mobile vs. Tabela Desktop**:
   - Desktop (`>= 768px`): Utiliza `<table class="hidden md:table">` ou grids multi-colunas.
   - Mobile (`< 768px`): Utiliza `<div class="space-y-3 md:hidden">` com cards individuais contendo cabeçalho com Badge, grid de 2 colunas e footer de ações.

## 🤖 FLUXO DE EXECUÇÃO DO AGENTE

1. **Inspecionar Ativos & Código**: Localize os arquivos em `src/app/mobile/` e `src/components/mobile/`.
2. **Navegar e Capturar Screenshots**: Use o `browser_subagent` com a task de navegar para `https://smart-hotel-zehla.vercel.app/mobile/pousada` ou `http://localhost:3000/mobile/pousada` configurado com a viewport `390x844`.
3. **Analisar Imagem**: Inspecione o screenshot gerado verificando alinhamento, espaçamento, tipografia e contraste.
4. **Editar Código**: Aplique refatorações pontuais em React/Tailwind.
5. **Re-verificar**: Dispare um novo ciclo do Browser Agent para confirmar a correção.
6. **Atualizar Artefato**: Mantenha o artefato `ddc_mobile_live_preview.md` atualizado para o usuário acompanhar lado a lado na IDE.
