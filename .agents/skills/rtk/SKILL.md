---
name: rtk
description: Rust Token Killer (RTK) - Proxy CLI de alta performance para compressão e filtragem de saída bash, economizando até 90% dos tokens de entrada para agentes de IA.
---

# RTK (Rust Token Killer) — Guia de Uso

O `rtk` intercepta e otimiza a saída de comandos de shell antes de serem consumidos pelo contexto do modelo de linguagem.

## Comandos Principais:
- `rtk git status` / `rtk git diff` / `rtk git log`: Saída git compacta e limpa.
- `rtk ls` / `rtk tree`: Formato hierárquico com sumário de contagem de arquivos.
- `rtk grep` / `rtk rg`: Agrupa resultados e trunca linhas excessivamente longas.
- `rtk gain`: Exibe o painel de economia de tokens acumulada na sessão.
