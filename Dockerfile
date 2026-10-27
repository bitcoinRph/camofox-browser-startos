FROM ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1@sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf

COPY gateway/ /app/gateway/
COPY skills/ /opt/camofox/skills/
