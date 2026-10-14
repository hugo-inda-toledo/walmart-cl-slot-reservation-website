# 🐳 Imagen de contenedor

[⬅️ Volver al README](../README.md)

La web se empaqueta en una imagen Nginx sin root (puerto interno 8080) que sirve la SPA y reenvía `/api/` a la API.

## Con Compose (recomendado)

```bash
docker compose up --build -d --wait
```

## Con `docker run`

```bash
docker build -t walmart-cl-slot-reservation-web .
docker run --rm -p 8081:8080 \
  -e API_UPSTREAM=http://host.docker.internal:8080 \
  walmart-cl-slot-reservation-web
```

Abre http://localhost:8081.

## Notas

- **Linux:** agrega `--add-host=host.docker.internal:host-gateway` al `docker run`; `docker-compose.yml` ya configura
  `extra_hosts` automáticamente.
- El `Dockerfile` admite el builder clásico (sin buildx).
- Nginx elimina el header `Origin` en el proxy: así el navegador nunca recibe un `CORS_REJECTED` de la API.
