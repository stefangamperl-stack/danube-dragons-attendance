# Salix

Salix ist die Anwesenheits- und Trainingsapp der Danube Dragons. Die Anwendung läuft als statische Web App auf Vercel und nutzt Supabase für Anmeldung, Rollen und Datenhaltung.

## PWA

Die App ist als Progressive Web App installierbar. Sie enthält:

* ein Web App Manifest mit Icons für Android und iOS
* einen Service Worker für App Shell und statische Dateien
* eine Installationsschaltfläche in unterstützten Browsern
* einen Hinweis bei fehlender Internetverbindung
* eine Aktualisierungsanzeige, sobald eine neue Version bereitsteht
* eine mobile Navigation mit sicheren Abständen für Geräte mit Displayaussparungen

Die Benutzeroberfläche kann nach dem ersten Laden auch ohne Verbindung geöffnet werden. Anmeldung, aktuelle Supabase Daten und Änderungen benötigen weiterhin Internet. Es werden bewusst keine Trainingsantworten offline zwischengespeichert, damit keine widersprüchlichen Daten entstehen.

## Lokale Entwicklung

Die PWA muss über HTTP auf `localhost` oder über HTTPS geladen werden. Das direkte Öffnen von `index.html` als Datei reicht für Service Worker nicht aus.

```bash
python3 -m http.server 4173
```

Danach ist die App unter `http://localhost:4173` erreichbar.

## Bereitstellung

Vercel stellt die App automatisch über HTTPS bereit. `vercel.json` sorgt dafür, dass Browser Aktualisierungen des Service Workers und des Manifests zuverlässig erkennen. Bei Änderungen am App Shell muss auch `CACHE_NAME` in `service-worker.js` erhöht werden.

## Sicherheit

Im Frontend darf ausschließlich der öffentliche Supabase Anon Key verwendet werden. Der Service Role Key gehört nur in geschützte Vercel Umgebungsvariablen. Zugriffsrechte müssen zusätzlich über Supabase Row Level Security abgesichert sein.
