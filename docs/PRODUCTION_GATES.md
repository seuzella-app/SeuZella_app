# Production Gates — Seu Zélla

## Regra
Uma rodada só é considerada concluída quando o código está commitado **e** o pipeline de produção termina com sucesso.

## Ordem
1. `npm ci`
2. `prisma generate`
3. `tsc --noEmit`
4. testes de segurança e contratos Mobile/PWA
5. `npm run build`
6. Vercel deployment
7. validação da URL publicada

## Não confundir
- Commit verde no GitHub não prova operação em dispositivo real.
- Build verde não prova integração com fechadura física.
- PWA instalado não prova push em iOS/Android.
- Teste estático não substitui E2E browser.

## Assets
Os ícones oficiais do produto permanecem pendentes até a entrega dos arquivos finais do símbolo “Zé”. Nenhum logo existente deve ser usado como substituto.
