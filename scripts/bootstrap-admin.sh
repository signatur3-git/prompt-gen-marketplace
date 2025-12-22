#!/usr/bin/env bash
# Bootstrap script to create the first admin user
# Usage: ./scripts/bootstrap-admin.sh [public_key]

set -e

POSTGRES_CONTAINER="rpg-marketplace-postgres"
DB_NAME="prompt_gen_marketplace"
DB_USER="postgres"

echo "🛡️  Prompt Gen Marketplace - Admin Bootstrap"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if public key was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <public_key>"
    echo ""
    echo "Example:"
    echo "  $0 abc123def456..."
    echo ""
    echo "Or promote first user:"
    echo "  $0 --first-user"
    exit 1
fi

PUBLIC_KEY="$1"

# Check if docker container is running
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo "❌ Error: PostgreSQL container '$POSTGRES_CONTAINER' is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

if [ "$PUBLIC_KEY" == "--first-user" ]; then
    echo "📋 Finding first registered user..."
    USER_ID=$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")

    if [ -z "$USER_ID" ]; then
        echo "❌ No users found in database"
        echo "   Register a user first at: http://localhost:5173/register"
        exit 1
    fi

    USER_ID=$(echo "$USER_ID" | xargs) # trim whitespace

    echo "✅ Found first user: $USER_ID"
    echo "🔄 Promoting to admin..."

    docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
        "UPDATE users SET is_admin = true WHERE id = '$USER_ID';"

    echo ""
    echo "✅ First user is now an admin!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Logout from the marketplace"
    echo "   2. Login again to get a new token with admin privileges"
    echo "   3. Visit http://localhost:5173/dashboard to see admin features"

else
    echo "🔍 Looking for user with public key: ${PUBLIC_KEY:0:16}..."

    USER_ID=$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT id FROM users WHERE public_key = '$PUBLIC_KEY';")

    if [ -z "$USER_ID" ]; then
        echo "❌ No user found with that public key"
        echo "   Make sure the user has registered first"
        exit 1
    fi

    USER_ID=$(echo "$USER_ID" | xargs) # trim whitespace

    echo "✅ Found user: $USER_ID"
    echo "🔄 Promoting to admin..."

    docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
        "UPDATE users SET is_admin = true WHERE id = '$USER_ID';"

    echo ""
    echo "✅ User is now an admin!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. If logged in, logout from the marketplace"
    echo "   2. Login again to get a new token with admin privileges"
    echo "   3. Visit http://localhost:5173/dashboard to see admin features"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Admin bootstrap complete!"

