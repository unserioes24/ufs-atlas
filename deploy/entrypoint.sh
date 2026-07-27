#!/bin/sh
# Waits for the database, applies the migrations and warms the cache.
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

    # Has to run before the migrations: the unique index on the user names can
    # only be created once no duplicates are left.
    php bin/console app:names:fix --no-interaction || true

    php bin/console doctrine:migrations:sync-metadata-storage --no-interaction >/dev/null 2>&1 || true

    # Existing databases were created before the migrations came in. Where
    # app_user is already there, the baseline counts as applied and is only
    # recorded. If it is recorded already the command fails - never mind.
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
