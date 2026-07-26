# Deploy — fish.tobee94.de

Ein Container: Apache mit PHP liefert den Guide **und** die API aus. Davor der
gemeinsame Traefik auf `web.fuewa.systems` (externes `web`-Netz), daneben ein
MariaDB-Container im internen Netz.

Die Seite wird nicht indexiert: `robots.txt`, `<meta name="robots">` und der
Header `X-Robots-Tag` setzen alle drei `noindex`.

## Aufbau

```
fish.tobee94.de
  └─ web   php:8.3-apache
       /                statische Dateien aus server/public (Guide)
       /api/…           Symfony 7 (Sitzungs-Login, Profile, Gruppen)
  └─ db    mariadb:11.4  internes Netz, benanntes Volume
```

Der Guide selbst hat keinen Build-Schritt: `index.html`, `app.js`, `gamedata.js`,
`maps/`, `fish/` und `models/` werden lokal mit `tools/extract.ps1` bzw.
`tools/meshexport.ps1` erzeugt, eingecheckt und beim Image-Bau nach
`server/public/` kopiert.

## Pipeline (`.gitlab-ci.yml`)

1. **build_web** — auf dem `arm`-Runner: `Dockerfile.web` bauen (Composer-Stage
   plus Laufzeit) und als `$CI_REGISTRY_IMAGE/web:{sha,latest}` pushen.
2. **deploy** *(manuell)* — `DOCKER_HOST=ssh://root@web.fuewa.systems`,
   `docker compose -f deploy/docker-compose.yml pull && up -d --wait`.

Beim Start gleicht der Container das Datenbankschema aus den Entities ab
(`doctrine:schema:update --force`, bewusst ohne `--complete`).

## Einmalige Einrichtung

**CI/CD-Variablen** (maskiert und geschützt):

| Variable | Zweck |
| --- | --- |
| `SSH_PRIVATE_KEY` | Zugang zu `root@web.fuewa.systems` (Deploy) |
| `APP_SECRET` | Symfony-Geheimnis, z. B. `openssl rand -hex 32` |
| `DB_PASSWORD` | Passwort des MariaDB-Benutzers `fish` |
| `DB_ROOT_PASSWORD` | MariaDB-Root-Passwort |
| `MAILER_DSN` | z. B. `smtp://benutzer:passwort@mail.example.org:587` |
| `MAILER_FROM` | Absenderadresse, z. B. `fish@unserioes24.de` |
| `MAILER_FROM_HEADER` | Anzeigename, z. B. `UFS Atlas <fish@unserioes24.de>` |

**DNS**: `fish.tobee94.de` → IP des Servers (A/AAAA). Traefik holt das
Zertifikat beim ersten Aufruf.

Damit die Anmeldecodes ankommen, sollte die Absenderdomain SPF und DKIM sauber
gesetzt haben.

## Anmeldung und Profile

- Anmeldung per E-Mail-Code, sechsstellig, 15 Minuten gültig, fünf Versuche.
  Die Sitzung liegt in einer PHP-Session (Cookie, 30 Tage), kein Token im Browser.
- Je Konto genau ein Profil. Jeder Spielstand-Upload ersetzt es vollständig.
- Gruppen: anlegen, per Code beitreten, Ranglisten für schwersten und längsten
  Fisch, Gesamtmasse, größte Masse einer Art, Artenzahl, komplette Reviere,
  Fänge und Angelzeit.
- Profilen folgen und sich direkt danebenstellen.

## Spielstand per Aufgabenplanung hochladen

In der App unter *Gruppen → Konto* steht der fertige Befehl mit dem persönlichen
Token:

```bat
curl -H "X-Api-Token: DEIN_TOKEN" ^
     --data-binary "@%UserProfile%\AppData\LocalLow\PlayWay\UltimateFishing\PROFILE_0" ^
     https://fish.tobee94.de/api/profile/upload
```

Der Server liest die Datei selbst aus, es wird nichts vorher aufbereitet.

## Lokal prüfen

```bash
docker build -f Dockerfile.web -t fish-web .
docker run --rm -p 8080:80 -e DATABASE_URL="mysql://…" fish-web
```

Ohne Server lässt sich `index.html` weiterhin direkt im Browser öffnen; Konten
und Gruppen sind dann ausgeblendet, alles Übrige läuft lokal.

## Neue Spieldaten einspielen

```powershell
.\tools\extract.ps1            # gamedata.js, maps/, fish/, server/data/
.\tools\meshexport.ps1         # models/
git add -A && git commit -m "Spieldaten aktualisiert" && git push
```

Danach in der Pipeline den `deploy`-Job manuell starten.
