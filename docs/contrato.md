# 📜 Contrato de la API

[⬅️ Volver al README](../README.md)

`contract/openapi.yml` es una **copia versionada** del contrato de la API, usada solo por las pruebas de conformidad.
No forma parte del build ni crea dependencia de rutas fuera de este repositorio.

Para actualizarla contra una API local:

```bash
npm run contract:sync
npm run contract:check
```

También puedes indicar una URL o una ruta local explícita:

```bash
npm run contract:sync -- --from http://localhost:8080/openapi/openapi.yml
```

`contract/source.json` registra la URL de origen, el `sha256` y la fecha de la copia.
