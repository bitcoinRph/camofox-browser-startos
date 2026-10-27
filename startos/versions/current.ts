import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.18.1:0',
  releaseNotes: {
    en_US:
      'Initial release of Camofox Browser 1.18.1 for StartOS. It adds a REST API, an MCP server with skills, a proxy setting, and Interactive Login through noVNC. Full notes: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    es_ES:
      'Primera versión de Camofox Browser 1.18.1 para StartOS. Incluye una API REST, un servidor MCP con skills, un ajuste de proxy y el inicio de sesión interactivo mediante noVNC. Notas completas: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    de_DE:
      'Erstveröffentlichung von Camofox Browser 1.18.1 für StartOS. Enthalten sind eine REST-API, ein MCP-Server mit Skills, eine Proxy-Einstellung und die interaktive Anmeldung über noVNC. Vollständige Hinweise: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    pl_PL:
      'Pierwsze wydanie Camofox Browser 1.18.1 dla StartOS. Zawiera API REST, serwer MCP z umiejętnościami, ustawienie proxy i logowanie interaktywne przez noVNC. Pełne informacje: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    fr_FR:
      'Version initiale de Camofox Browser 1.18.1 pour StartOS. Elle ajoute une API REST, un serveur MCP avec skills, un réglage de proxy et la connexion interactive via noVNC. Notes complètes : https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
