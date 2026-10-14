# 🧑‍💻 Desarrollo local

[⬅️ Volver al README](../README.md)

Para trabajar en el código con recarga en caliente (sin construir la imagen).

## Pasos

```bash
npm ci        # instala exactamente lo del lockfile
npm run dev   # Vite en http://localhost:5173
```

Necesitas Node.js ≥ 22.12 (la versión fijada en `.nvmrc` es Node 24). Con `nvm`: `nvm use`.

En desarrollo, las solicitudes `/api` se reenvían a `http://localhost:8080` por defecto (variable `API_PROXY_TARGET`):
el navegador usa el mismo origen de la web, así que no hace falta configurar CORS.

> 💡 La API debe estar corriendo. Mira su [README](https://github.com/hugo-inda-toledo/walmart-cl-slot-reservation-api).

## Comandos

| Comando                                        | Propósito                                                |
| ---------------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                                  | Inicia Vite en el puerto 5173                            |
| `npm run lint`                                 | Revisa ESLint y formato (Prettier)                       |
| `npm run typecheck`                            | Verifica TypeScript                                      |
| `npm run test`                                 | Pruebas unitarias y de componentes                       |
| `npm run test:coverage`                        | Pruebas con umbrales de cobertura                        |
| `npm run build`                                | Genera `dist/`                                           |
| `npm run verify`                               | Lint, tipos, cobertura y build (lo mismo que hace la CI) |
| `npm run e2e:install`                          | Descarga Chromium para Playwright                        |
| `npm run e2e`                                  | Ejecuta los E2E contra la API local                      |
| `npm run contract:check`                       | Compara la copia del contrato con su fuente              |
| `npm run contract:sync -- --from <URL-o-ruta>` | Actualiza la copia del contrato                          |
