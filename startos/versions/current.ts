import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.18.1:2',
  releaseNotes: {
    en_US:
      'P1 runtime repair: return correct REST and MCP errors, handle direct-download navigation, restore legacy frameset snapshots, verify Camoufox beta.30 assets, and expose independent tab and MCP idle timers. Defaults remain unchanged.',
    es_ES:
      'Reparación P1: corrige errores REST y MCP, gestiona descargas por navegación directa, restaura instantáneas de frameset, verifica Camoufox beta.30 y separa los tiempos de inactividad de pestañas y MCP. Los valores predeterminados no cambian.',
    de_DE:
      'P1-Laufzeitreparatur: korrekte REST- und MCP-Fehler, direkte Download-Navigation, wiederhergestellte Frameset-Snapshots, geprüfte Camoufox-beta.30-Dateien sowie getrennte Tab- und MCP-Leerlaufzeiten. Standardwerte bleiben unverändert.',
    pl_PL:
      'Naprawa P1: poprawne błędy REST i MCP, obsługa pobierania przy bezpośredniej nawigacji, przywrócone migawki frameset, weryfikacja Camoufox beta.30 oraz osobne limity bezczynności kart i MCP. Wartości domyślne pozostają bez zmian.',
    fr_FR:
      'Correction P1 : erreurs REST et MCP correctes, navigation de téléchargement direct, instantanés frameset rétablis, fichiers Camoufox beta.30 vérifiés et délais distincts pour les onglets et MCP. Les valeurs par défaut restent inchangées.',
  },
  // Optional additive settings only. Never rewrite profiles, credentials or settings.
  // The previous wrapper ignores unknown fields, so rollback needs no deletion.
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
