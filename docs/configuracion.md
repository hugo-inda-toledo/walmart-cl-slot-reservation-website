# ⚙️ Configuración

[⬅️ Volver al README](../README.md)

Las variables se leen del entorno; copia `.env.example` a `.env` si quieres cambiarlas (el `.env` no se versiona).

| Variable            | Predeterminado                              | Uso                                                                             |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | vacía                                       | URL base absoluta para desarrollo en origen cruzado. Vacía usa el mismo origen. |
| `API_PROXY_TARGET`  | `http://localhost:8080`                     | Destino del proxy `/api` de Vite (desarrollo).                                  |
| `E2E_API_URL`       | `http://localhost:8080`                     | API local que Playwright comprueba y usa para los E2E.                          |
| `CONTRACT_URL`      | `http://localhost:8080/openapi/openapi.yml` | Origen predeterminado de la copia del contrato.                                 |
| `WEB_PORT`          | `8081`                                      | Puerto donde Docker publica la web.                                             |
| `API_UPSTREAM`      | `http://host.docker.internal:8080`          | Destino del proxy Nginx dentro de la imagen.                                    |

## Notas de seguridad

- La imagen siempre usa el proxy de mismo origen (`/api`); su CSP no permite una URL absoluta de API.
- No se envían datos del cliente en el cuerpo: la identidad demo viaja exclusivamente en el header `X-Customer-Id`.
