# 🧪 Pruebas de extremo a extremo (E2E)

[⬅️ Volver al README](../README.md)

Playwright prueba la web contra la **API real** (no hay mocks).

## Cómo correrlas

1. Levanta la API ([README de la API](https://github.com/hugo-inda-toledo/walmart-cl-slot-reservation-api)): `docker compose up --build -d --wait`.
2. Una vez por máquina: `npm ci && npm run e2e:install`.
3. `npm run e2e`

La suite comprueba antes que `GET /api/v1/demo-addresses` responda; si no, falla con un mensaje claro.

## Qué cubre

- Reserva completa con el cliente `juan-soto` y la dirección `santiago-monjitas`.
- Una fecha agotada para `la-serena-monjitas`.
- Accesibilidad WCAG 2.2 A/AA (axe) y el ancho móvil de 360 px.

Después de cada prueba elimina el _hold_ activo o cancela la reserva confirmada con el mismo cliente demo, para que
puedas repetirla sin ensuciar el estado.

## Otras comprobaciones

| Qué                                      | Comando                        |
| ---------------------------------------- | ------------------------------ |
| Unitarias y de componentes con cobertura | `npm run verify`               |
| Smoke full-stack (página, proxy, CORS)   | `./scripts/smoke-fullstack.sh` |
