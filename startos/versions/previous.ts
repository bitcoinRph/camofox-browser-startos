import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous = VersionInfo.of({
  version: '1.18.1:1',
  releaseNotes: {
    en_US:
      'Security update: API keys and VNC passwords are entered in masked action forms and are no longer returned in action results. Connection snippets now use placeholders. Full upstream notes: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    es_ES:
      'Actualización de seguridad: las claves de API y contraseñas VNC se introducen en formularios enmascarados y ya no se devuelven en los resultados de las acciones. Los fragmentos de conexión usan marcadores. Notas completas: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    de_DE:
      'Sicherheitsupdate: API-Schlüssel und VNC-Passwörter werden in maskierten Aktionsformularen eingegeben und nicht mehr in Aktionsergebnissen zurückgegeben. Verbindungs-Snippets verwenden Platzhalter. Vollständige Hinweise: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    pl_PL:
      'Aktualizacja bezpieczeństwa: klucze API i hasła VNC są wpisywane w maskowanych formularzach akcji i nie są już zwracane w wynikach. Fragmenty połączeń używają symboli zastępczych. Pełne informacje: https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
    fr_FR:
      'Mise à jour de sécurité : les clés API et mots de passe VNC sont saisis dans des formulaires masqués et ne sont plus renvoyés dans les résultats des actions. Les extraits de connexion utilisent des espaces réservés. Notes complètes : https://github.com/jo-inc/camofox-browser/releases/tag/v1.18.1',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
