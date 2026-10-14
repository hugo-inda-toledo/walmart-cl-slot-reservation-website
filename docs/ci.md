# 🔁 Integración continua

[⬅️ Volver al README](../README.md)

Dos workflows en `.github/workflows/`:

| Workflow  | Qué hace                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`  | `npm run verify` (lint, tipos, pruebas con cobertura y build), `npm audit` (severidad alta) y `docker build`; más un job que lintea los workflows con actionlint |
| `e2e.yml` | Levanta la **API real**, corre Playwright (`npm run e2e`), levanta esta web y ejecuta el smoke full-stack                                                        |

## Configuración que necesita `e2e.yml`

En el repositorio de GitHub: _Settings → Secrets and variables → Actions_.

| Tipo                                | Nombre           | Valor                                              |
| ----------------------------------- | ---------------- | -------------------------------------------------- |
| Variable                            | `API_REPOSITORY` | `hugo-inda-toledo/walmart-cl-slot-reservation-api` |
| Variable (opcional)                 | `API_REF`        | Rama o tag de la API (por defecto `main`)          |
| Secreto (solo si la API es privada) | `API_REPO_TOKEN` | Token con lectura del repo de la API               |

`API_REPOSITORY` es opcional: si no la defines, el workflow usa `hugo-inda-toledo/walmart-cl-slot-reservation-api`.
Defínela solo si tu API vive en otro repositorio.

El workflow hace checkout de ambos repositorios como carpetas hermanas (`web/` y `api/`), porque el contexto de build
de la web no incluye la API.
