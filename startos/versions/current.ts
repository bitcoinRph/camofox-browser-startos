import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.18.1:2',
  releaseNotes: {
    en_US:
      'Wrapper P1: classify malformed MCP requests, return typed tool protocol errors, and expose independent tab and MCP idle timers. Defaults and upstream image are unchanged. No browser-engine fixes are included.',
    es_ES:
      'Wrapper P1: clasifica solicitudes MCP incorrectas, devuelve errores de protocolo tipados y expone temporizadores independientes de pestañas y MCP. Valores predeterminados e imagen sin cambios. Sin correcciones del motor.',
    de_DE:
      'Wrapper P1: klassifiziert fehlerhafte MCP-Anfragen, liefert typisierte Protokollfehler und bietet getrennte Tab- und MCP-Leerlaufzeiten. Standardwerte und Upstream-Image bleiben unverändert. Keine Browser-Engine-Korrekturen.',
    pl_PL:
      'Wrapper P1: klasyfikuje błędne żądania MCP, zwraca typowane błędy protokołu i udostępnia niezależne limity bezczynności kart i MCP. Domyślne wartości i obraz bez zmian. Bez poprawek silnika przeglądarki.',
    fr_FR:
      'Wrapper P1 : classe les requêtes MCP incorrectes, renvoie des erreurs de protocole typées et expose des délais distincts pour les onglets et MCP. Valeurs par défaut et image inchangées. Aucun correctif du moteur.',
  },
  // Optional additive settings only. Never rewrite profiles, credentials or settings.
  // The previous wrapper ignores unknown fields, so rollback needs no deletion.
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
