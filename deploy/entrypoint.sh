#!/bin/sh
# Wartet auf die Datenbank, spielt Migrationen ein und wärmt den Cache.
set -e

cd /var/www/html

if [ -n "$DATABASE_URL" ]; then
    echo "Warte auf die Datenbank ..."
    i=0
    until php bin/console dbal:run-sql "SELECT 1" >/dev/null 2>&1; do
        i=$((i + 1))
        if [ "$i" -ge 30 ]; then
            echo "Datenbank nicht erreichbar – starte trotzdem." >&2
            break
        fi
        sleep 2
    done

    # Kein Migrationsverlauf nötig: das Schema wird aus den Entities abgeleitet.
    # Bewusst ohne --complete, damit nichts unbeabsichtigt entfernt wird.
    echo "Schema abgleichen ..."
    php bin/console doctrine:schema:update --force --no-interaction || \
        echo "Schemaabgleich fehlgeschlagen – bitte Logs prüfen." >&2
fi

php bin/console cache:warmup --no-interaction || true
chown -R www-data:www-data var

exec "$@"
