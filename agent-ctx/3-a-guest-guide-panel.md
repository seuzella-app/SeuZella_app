# Task 3-a: GuestGuidePanel Component

## Task Summary
Created `/home/z/my-project/src/components/ddc/GuestGuidePanel.tsx` — the "Guia Digital" tab component for the DDC dashboard.

## Work Details

### Component Created
- **File**: `src/components/ddc/GuestGuidePanel.tsx`
- **Export added to**: `src/components/ddc/index.ts`

### Features Implemented
1. **List existing guides** — Fetches from `/api/ddc/guest-guide` (GET) with tenantId param, displays in responsive card grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
2. **Auto-generate guide button** — POST to `/api/ddc/guest-guide` with `{ autoGenerate: true, tenantId }`, available in both header and empty state
3. **QR Code display** — Uses `qrcode` package to generate QR PNG data URL from `https://seuzella.com/guide/${slug}`, displayed inside each guide card with niche-themed container (`bg-emerald-500/15` / `bg-blue-500/15`)
4. **Guide stats** — Shows `viewCount`, `lastViewedAt` (formatted pt-BR), `status` badge (active/draft/archived) with color-coded icons and text
5. **Guide link** — Clickable link to `https://seuzella.com/guide/${slug}` with "Copiar link" button and dropdown menu action
6. **Delete guide** — DELETE to `/api/ddc/guest-guide` with guideId + tenantId query params, confirmation dialog with guide summary before deletion
7. **Empty state** — Friendly message encouraging creation, with feature preview cards (Wi-Fi, Dicas, QR Code, Regras), auto-generate button, and tenantId warning

### Props Interface
```typescript
interface GuestGuidePanelProps {
  niche: 'pousada' | 'airbnb';
  tenantId?: string;
  propertyName?: string;
}
```

### Style Conventions Followed
- Dark theme: `bg-[#0a0a0f]`, `bg-[#121216]`, `border-white/[0.04]`
- Niche accents: `bg-emerald-500/15` for pousada, `bg-blue-500/15` for airbnb
- Badge status colors: emerald (active), yellow (draft), zinc (archived)
- Card layout with `p-4` content padding
- Responsive grid for guide cards
- `max-h-[600px] overflow-y-auto` with thin scrollbar styling for long lists
- Framer Motion animations: staggered entry, scale transitions, AnimatePresence for deletions
- Proper loading skeleton with animated spinners
- Dialog confirmation for destructive actions (delete)

### Verification
- `bun run lint`: 0 errors, 499 warnings (all pre-existing)
- TypeScript: No errors related to GuestGuidePanel
- Dev server: No compilation issues
- API route already existed at `/api/ddc/guest-guide` with GET, POST, PUT, DELETE handlers
