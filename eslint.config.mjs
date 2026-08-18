import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";
import { dirname } from "path";
import { fileURLToPath } from "url";

// ============================================================
// Airbnb JavaScript Style Guide — integração
// ============================================================
// As regras-chave do guia Airbnb foram adicionadas manualmente no
// bloco de rules abaixo (linhas marcadas com "Airbnb Style Guide").
// Não importamos o preset via ESM porque eslint-config-airbnb-base
// não suporta import ESM direto no ESLint 9 (flat config).
// As regras foram extraídas de:
// https://github.com/airbnb/javascript/blob/master/README.md
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// V11 Volume 6 — Custom ESLint rule:
//   zella-v11/no-use-client-in-route
//
// Blocks `'use client'` directives in App Router route files
// (page.tsx, layout.tsx, route.ts, loading.tsx, error.tsx,
// not-found.tsx, default.tsx). Client Components must live in
// the components/ tree (or in a `[name].client.tsx` co-located
// file). This prevents accidental hydration of entire routes,
// which would defeat PPR and balloon the client bundle.
// ============================================================
const zellaV11NoUseClientInRoute = {
  meta: {
    type: 'problem',
    docs: {
      description: "V11 Volume 6 — forbid 'use client' in App Router route files",
    },
    schema: [],
    messages: {
      useClientInRoute:
        "'use client' is forbidden in route file '{{filename}}'. Move the client logic to a co-located .client.tsx file or to src/components/, then import it.",
    },
  },
  create(context) {
    const filename = context.filename || '';
    const routeFilePattern = /(^|\/)(page|layout|route|loading|error|not-found|default|template)\.(tsx|ts|jsx|js)$/;
    if (!routeFilePattern.test(filename)) return {};
    return {
      ExpressionStatement(node) {
        if (node.expression.type === 'Literal' && typeof node.expression.value === 'string' && node.expression.value === 'use client') {
          context.report({ node, messageId: 'useClientInRoute', data: { filename: filename.split('/').pop() } });
        }
      },
    };
  },
};

// ============================================================
// V11 Volume 6 — Custom ESLint rule:
//   zella-v11/no-edge-incompatible-in-middleware
// ============================================================
const EDGE_INCOMPATIBLE_MODULES = ['@prisma/client', 'bcryptjs', 'sharp', 'socket.io', 'fs', 'child_process', 'node:fs', 'node:child_process'];
const zellaV11NoEdgeIncompatibleInMiddleware = {
  meta: {
    type: 'problem',
    docs: { description: 'V11 Volume 6 — forbid Edge-incompatible imports in middleware.ts' },
    schema: [],
    messages: {
      edgeIncompatible: "Module '{{module}}' is not compatible with the Edge Runtime and cannot be imported in middleware.ts.",
    },
  },
  create(context) {
    const filename = context.filename || '';
    if (!/(^|\/)middleware\.(ts|tsx|js|jsx)$/.test(filename)) return {};
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (EDGE_INCOMPATIBLE_MODULES.includes(src) || EDGE_INCOMPATIBLE_MODULES.some((m) => src.startsWith(m + '/'))) {
          context.report({ node, messageId: 'edgeIncompatible', data: { module: src } });
        }
      },
    };
  },
};

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: {
      "react-hooks": reactHooks,
      "zella-v11": {
        rules: {
          'no-use-client-in-route': zellaV11NoUseClientInRoute,
          'no-edge-incompatible-in-middleware': zellaV11NoEdgeIncompatibleInMiddleware,
        },
      },
    },
  },
  {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // React rules
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/immutability": "off",
    "react-hooks/refs": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "error",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",

    // ── Airbnb Style Guide — regras-chave selecionadas ──────────────
    // Referência: https://github.com/airbnb/javascript
    //
    // Aplicamos apenas as regras MAIS CRÍTICAS que previnem bugs reais.
    // Regras puramente de estilo (ponto-e-vírgula, aspas, indentação)
    // ficam como "warn" para não bloquear o desenvolvimento.
    //
    // Regras de BUG PREVENTION (error = bloqueia commit no CI):
    "eqeqeq": ["error", "always"],                    // 15.1 — === nunca ==
    "no-var": "error",                                // 13.1 — const nunca var
    "no-with": "error",                               // nunca usar with()
    "no-eval": "error",                                // 21.1 — eval() proibido
    "no-implied-eval": "error",                        // 21.2 — eval implícito proibido
    "no-new-func": "error",                            // 7.11 — Function constructor proibido
    "no-return-assign": ["error", "always"],           // 7.10 — return assignment proibido
    "no-self-compare": "error",                        // 15.11 — x === x proibido
    "no-sequences": "error",                           // 7.13 — comma operator proibido
    "no-throw-literal": "error",                       // 7.12 — throw só Error objects
    "no-unused-expressions": "error",                  // 7.8 — expressões sem uso
    "no-alert": "warn",                                // 21.4 — alert() desencorajado
    "no-labels": "error",                              // 13.5 — labels proibidos
    "no-label-var": "error",                           // 13.6 — label com mesmo nome de var

    // Regras de NAMING (warn = avisa mas não bloqueia):
    "camelcase": ["warn", { properties: "never" }],   // 23.2 — camelCase para variáveis
    "new-cap": ["warn", { capIsNew: false }],          // 23.3 — construtores com PascalCase
    "no-multi-spaces": "warn",                          // 19.9 — espaços múltiplos

    // Regras de OBJETOS/ARRAYS (warn):
    "no-array-constructor": "warn",                     // 4.1 — [] em vez de new Array()
    "no-new-object": "warn",                            // 3.1 — {} em vez de new Object()
    "no-extend-native": "error",                        // 3.5 — não estender prototype nativo
    "no-iterator": "error",                             // 3.6 — __iterator__ proibido
    "no-proto": "error",                                // 3.7 — __proto__ proibido

    // Regras de DESTRUCTURING (warn — Airbnb recomenda):
    "prefer-destructuring": ["warn", {                  // 5.1 — const { a } = obj em vez de const a = obj.a
      VariableDeclarator: { array: true, object: true },
      AssignmentExpression: { array: false, object: false },
    }],

    // Regras de TEMPLATE STRINGS (warn):
    "prefer-template": "warn",                          // 6.1 — template literals em vez de concatenação
    "prefer-arrow-callback": "warn",                    // 8.1 — arrow functions para callbacks

    // V11 Volume 6 — Custom rules (error = blocks commit via CI)
    "zella-v11/no-use-client-in-route": "error",
    "zella-v11/no-edge-incompatible-in-middleware": "error",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "examples/**",
    "skills",
    "ddc_extracted/**",
    "dist/**",
    "landing_extracted/**",
    "staging-zcc-prisma/**",
    "staging-api-ddc/**",
    "extract-ddc/**",
    "tool-results/**",
    "mini-services/**",
    "simple-server.js",
    "start-dev.sh",
    "deploy.sh",
    "quick-start.sh",
  ],
}];

export default eslintConfig;
