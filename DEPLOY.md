# Deploy — fish.tobee94.de

Statische Seite, von Caddy in einem Docker-Container ausgeliefert, hinter
**demselben** Traefik-/Let's-Encrypt-Host wie fuewa.systems und tobee94.de
(`web.fuewa.systems`, gemeinsames externes `web`-Netz).

Die Seite wird nicht indexiert: `robots.txt`, `<meta name="robots">` und der
Header `X-Robots-Tag` setzen alle drei `noindex`.

## Pipeline (`.gitlab-ci.yml`)

1. **build_web** — auf dem `arm`-Runner: Image aus `Dockerfile.web` bauen und
   als `$CI_REGISTRY_IMAGE/web:{sha,latest}` pushen.
2. **deploy** *(manuell)* — `DOCKER_HOST=ssh://root@web.fuewa.systems`,
   `docker compose -f deploy/docker-compose.yml pull && up -d --wait`.

Einen Build-Schritt für die Seite gibt es nicht: der Guide besteht aus fertigem
HTML/JS/CSS. `gamedata.js`, `maps/`, `fish/` und `models/` werden lokal mit
`tools/extract.ps1` aus der Spielinstallation erzeugt und eingecheckt.

## Einmalige Einrichtung

- **CI/CD-Variable** `SSH_PRIVATE_KEY` — Schlüssel mit Zugang zu
  `root@web.fuewa.systems` (der Deploy-Key von fuewa lässt sich wiederverwenden).
  Maskiert und geschützt setzen.
- **DNS**: `fish.tobee94.de` → IP des Servers (A/AAAA). Traefik holt das
  Zertifikat beim ersten Aufruf automatisch.
- Das gemeinsame `web`-Netz und Traefik existieren auf dem Host bereits.

## Lokal prüfen

```bash
# genau das Image bauen, das auch die CI baut
docker build -f Dockerfile.web -t fish-web .
docker run --rm -p 8080:80 fish-web      # http://localhost:8080

# oder ganz ohne Docker: index.html direkt im Browser öffnen
```

## Neue Spieldaten einspielen

```powershell
.\tools\extract.ps1            # gamedata.js, maps/, fish/
.\tools\meshexport.ps1         # models/
git add -A && git commit -m "Spieldaten aktualisiert" && git push
```

Danach in der Pipeline den `deploy`-Job manuell starten.
