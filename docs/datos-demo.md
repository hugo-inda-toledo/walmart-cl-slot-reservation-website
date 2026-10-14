# 🎭 Datos demo

[⬅️ Volver al README](../README.md)

La API local trae datos de demostración listos para probar.

## Clientes

Pedro Pérez, María González y Juan Soto (el cliente por defecto de la web y de los E2E es `juan-soto`).

## Direcciones

| Dirección                                    | Resultado esperado                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Monjitas 879, Santiago (`santiago-monjitas`) | Cubierta: fechas y bloques disponibles                                             |
| La Serena-Coquimbo (`la-serena-monjitas`)    | Cubierta, con al menos una fecha **Agotado** (no seleccionable)                    |
| Av. Libertad 100, Viña del Mar               | Cubierta por comuna (`LIDER_REGION_05`); no trae coordenadas y la web no las envía |
| Av. Pajaritos 2000, Maipú (`maipu-inactiva`) | Sin cobertura: "la zona está inactiva", con opción de cambiar dirección            |
| Providencia, Chicureo y otros escenarios     | Direcciones demo adicionales que expone la API (`GET /api/v1/demo-addresses`)      |

La fecha agotada de La Serena depende de la configuración del catálogo de la API local
(`APP_CATALOG_DEMO_ENABLED=true`, el valor por defecto del compose) y es la que usa el E2E.
