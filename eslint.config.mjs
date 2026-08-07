import nextCoreWebVitals from "eslint-config-next/core-web-vitals";  
import nextTypescript from "eslint-config-next/typescript";  
import reactHooks from "eslint-plugin-react-hooks";
import { dirname } from "path";  
import { fileURLToPath } from "url";

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
