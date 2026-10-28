import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.18.1:3',
  releaseNotes: {
    en_US:
      'Wrapper-only release: consolidate the reviewed browser source and sanitized offline benchmark in this repository. The pinned runtime image is unchanged. Additional browser-source changes are not yet in that image. No persistent data changes.',
    es_ES:
      'Versión solo del paquete: consolida el código revisado del navegador y el banco de pruebas sin conexión y saneado. La imagen de ejecución fijada no cambia. Los cambios adicionales del navegador aún no están en esa imagen. No hay cambios de datos persistentes.',
    de_DE:
      'Reine Paketversion: geprüfter Browser-Quellcode und bereinigter Offline-Benchmark sind jetzt in diesem Repository zusammengeführt. Das festgelegte Laufzeit-Image bleibt unverändert. Zusätzliche Browser-Änderungen sind noch nicht darin enthalten. Persistente Daten bleiben unverändert.',
    pl_PL:
      'Wydanie wyłącznie opakowania: łączy sprawdzone źródła przeglądarki i oczyszczony test offline w tym repozytorium. Przypięty obraz uruchomieniowy pozostaje bez zmian. Dodatkowe zmiany źródłowe przeglądarki nie są jeszcze w tym obrazie. Dane trwałe pozostają bez zmian.',
    fr_FR:
      'Version du paquet uniquement : le code source du navigateur vérifié et le banc de test hors ligne assaini sont regroupés dans ce dépôt. L’image d’exécution épinglée reste inchangée. Les modifications supplémentaires du navigateur ne sont pas encore dans cette image. Aucune donnée persistante ne change.',
  },
  // Repository-only release. Never rewrite profiles, credentials, or settings.
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
