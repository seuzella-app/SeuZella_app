---
name: responsive-design
description: Padrões avançados de design responsivo com Tailwind CSS (Desktop Table vs Mobile Cards, breakpoints md/lg/xl, layouts adaptativos).
---

# RESPONSIVE DESIGN SKILL

Esta skill estabelece a especificação técnica para manter compatibilidade fluida entre Desktop e Mobile no ecossistema Seu Zélla.

## 📐 PADRÃO DETERMINÍSTICO DE COMPONENTES

### 1. Tabela Responsiva (Tabela Desktop / Cards Mobile)
```tsx
<div className="w-full">
  {/* Desktop: >= 768px */}
  <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800 bg-[#121216]">
    <table className="w-full text-left text-sm">...</table>
  </div>

  {/* Mobile: < 768px */}
  <div className="space-y-3 md:hidden">
    {items.map(item => (
      <article key={item.id} className="p-4 rounded-xl border border-white/[0.08] bg-[#121216] space-y-3">
        ...
      </article>
    ))}
  </div>
</div>
```

### 2. Auto-Redirecionamento de Rota por Viewport
- Telas `< 768px`: Exibe/Redireciona para `/mobile/pousada` ou `/mobile/airbnb` em Tela Cheia.
- Telas `>= 768px`: Exibe/Redireciona para `/ddc/pousada` ou `/ddc/airbnb` no Dashboard Desktop.
