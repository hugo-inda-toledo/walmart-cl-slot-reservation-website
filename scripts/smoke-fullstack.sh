#!/usr/bin/env bash
# Comprueba que la web sirve la SPA y reenvía peticiones hacia la API local.
set -euo pipefail

web_url="${1:-${WEB_URL:-http://localhost:${WEB_PORT:-8081}}}"
web_url="${web_url%/}"
curl_options=(--silent --show-error --connect-timeout 5 --max-time 15)
failed=0

ok() {
  printf 'OK %s\n' "$1"
}

fail() {
  printf 'FALLA %s\n' "$1"
  failed=1
}

request() {
  local method="$1"
  local path="$2"
  shift 2
  local response

  if ! response="$(curl "${curl_options[@]}" -X "$method" -D - -w '\n%{http_code}' "$@" "$web_url$path")"; then
    response_headers=''
    response_body=''
    response_status='000'
    return 1
  fi

  response_status="${response##*$'\n'}"
  response="${response%$'\n'*}"
  response_headers="${response%%$'\r\n\r\n'*}"
  response_body="${response#*$'\r\n\r\n'}"
}

if ! request GET '/'; then
  fail 'página principal: no se pudo conectar a la web'
elif [[ "$response_status" != '200' ]]; then
  fail "página principal: se esperaba HTTP 200 y se recibió $response_status"
elif [[ "$response_body" != *'Reservar horario'* ]]; then
  fail 'página principal: no contiene "Reservar horario"'
else
  ok 'página principal'
fi

if ! request GET '/api/v1/demo-addresses'; then
  fail 'proxy de direcciones demo: no se pudo conectar a la web o a la API'
elif [[ "$response_status" != '200' ]]; then
  fail "proxy de direcciones demo: se esperaba HTTP 200 y se recibió $response_status"
elif [[ "$response_body" != *'la-serena-monjitas'* ]]; then
  fail 'proxy de direcciones demo: la respuesta no contiene la dirección demo esperada'
else
  ok 'proxy de direcciones demo'
fi

if ! request POST '/api/v1/slot-holds' \
  -H "Origin: $web_url" \
  -H 'Content-Type: application/json' \
  -H 'X-Customer-Id: smoke' \
  -H "Idempotency-Key: smoke-$(date +%s)" \
  --data '{}'; then
  fail 'proxy de retención: no se pudo conectar a la web o a la API'
elif [[ "$response_status" != '400' ]]; then
  fail "proxy de retención: se esperaba HTTP 400 VALIDATION_ERROR y se recibió $response_status"
elif [[ "$response_body" == *'CORS_REJECTED'* ]]; then
  fail 'proxy de retención: la API rechazó el Origin con CORS_REJECTED'
elif [[ "$response_body" != *'VALIDATION_ERROR'* ]]; then
  fail 'proxy de retención: la respuesta no informa VALIDATION_ERROR'
else
  ok 'proxy de retención y CORS'
fi

exit "$failed"
