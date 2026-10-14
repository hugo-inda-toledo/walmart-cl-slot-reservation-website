import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const featureNames = [
  "address",
  "customer",
  "delivery-dates",
  "reservation",
  "slots",
];
const sourceFiles = ["**/*.{ts,tsx}"];

function restrictedFeatureImports(featureName) {
  return featureNames
    .filter((name) => name !== featureName)
    .map((name) => `@/features/${name}/**`);
}

export default tseslint.config(
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**", "verification/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: sourceFiles,
  })),
  {
    files: sourceFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "src/api/x.ts",
            "src/shared/x.ts",
            "src/features/slots/x.ts",
            "src/features/slots/components/x.tsx",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/api/**", "@/app/**", "@/features/**"],
              message: "shared no puede importar api, app ni features.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**", "@/features/**"],
              message: "api no puede importar app ni features.",
            },
          ],
        },
      ],
    },
  },
  ...featureNames.map((featureName) => ({
    files: [`src/features/${featureName}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: restrictedFeatureImports(featureName),
              message: "una feature no puede importar otra feature.",
            },
          ],
        },
      ],
    },
  })),
  ...featureNames.map((featureName) => ({
    files: [`src/features/${featureName}/components/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: restrictedFeatureImports(featureName),
              message: "una feature no puede importar otra feature.",
            },
            {
              group: ["@/api/**"],
              allowTypeImports: true,
              message:
                "los componentes de features solo pueden importar tipos desde api.",
            },
          ],
        },
      ],
    },
  })),
);
