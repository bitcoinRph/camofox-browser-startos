FROM ghcr.io/jo-inc/camofox-browser:1.18.1@sha256:cff2c1432b609bde9c9d0b91e5b924dae0799d3c7bc9d468c0bc949325beaf2a

COPY gateway/ /app/gateway/
COPY skills/ /opt/camofox/skills/
