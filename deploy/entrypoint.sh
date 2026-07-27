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

    # Muss vor den Migrationen laufen: der eindeutige Index auf den
    # Benutzernamen entsteht erst, wenn keine Dubletten mehr existieren.
    php bin/console app:names:fix --no-interaction || true

    php bin/console doctrine:migrations:sync-metadata-storage --no-interaction >/dev/null 2>&1 || true

    # Bestehende Datenbanken sind vor Einführung der Migrationen entstanden.
    # Steht app_user schon da, gilt der Ausgangsstand als eingespielt und wird
    # nur verbucht. Ist er bereits verbucht, schlägt der Befehl fehl - egal.
    if php bin/console dbal:run-sql "SELECT 1 FROM app_user LIMIT 1" >/dev/null 2>&1; then
        php bin/console doctrine:migrations:version \
            --add 'DoctrineMigrations\Version20260727090000' --no-interaction \
            >/dev/null 2>&1 || true
    fi

    echo "Migrationen einspielen ..."
    php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration || \
        echo "Migration fehlgeschlagen - bitte Logs pruefen." >&2
fi

php bin/console cache:warmup --no-interaction || true
chown -R www-data:www-data var

exec "$@"
