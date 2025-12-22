# Bootstrap script to create the first admin user
# Usage: .\scripts\bootstrap-admin.ps1 [public_key]

param(
    [Parameter(Position=0)]
    [string]$PublicKey
)

$PostgresContainer = "rpg-marketplace-postgres"
$DbName = "prompt_gen_marketplace"
$DbUser = "postgres"

Write-Host "🛡️  Prompt Gen Marketplace - Admin Bootstrap" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check if public key was provided
if (-not $PublicKey) {
    Write-Host ""
    Write-Host "Usage: .\scripts\bootstrap-admin.ps1 <public_key>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  .\scripts\bootstrap-admin.ps1 abc123def456..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or promote first user:" -ForegroundColor Yellow
    Write-Host "  .\scripts\bootstrap-admin.ps1 --first-user" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check if docker container is running
$containerRunning = docker ps --filter "name=$PostgresContainer" --format "{{.Names}}"
if (-not $containerRunning) {
    Write-Host "❌ Error: PostgreSQL container '$PostgresContainer' is not running" -ForegroundColor Red
    Write-Host "   Start it with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

if ($PublicKey -eq "--first-user") {
    Write-Host "📋 Finding first registered user..." -ForegroundColor Yellow

    $userId = docker exec -i $PostgresContainer psql -U $DbUser -d $DbName -t -c "SELECT id FROM users ORDER BY created_at ASC LIMIT 1;"

    if (-not $userId -or $userId.Trim() -eq "") {
        Write-Host "❌ No users found in database" -ForegroundColor Red
        Write-Host "   Register a user first at: http://localhost:5173/register" -ForegroundColor Yellow
        exit 1
    }

    $userId = $userId.Trim()

    Write-Host "✅ Found first user: $userId" -ForegroundColor Green
    Write-Host "🔄 Promoting to admin..." -ForegroundColor Yellow

    docker exec -i $PostgresContainer psql -U $DbUser -d $DbName -c "UPDATE users SET is_admin = true WHERE id = '$userId';" | Out-Null

    Write-Host ""
    Write-Host "✅ First user is now an admin!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Logout from the marketplace"
    Write-Host "   2. Login again to get a new token with admin privileges"
    Write-Host "   3. Visit http://localhost:5173/dashboard to see admin features"

} else {
    $shortKey = $PublicKey.Substring(0, [Math]::Min(16, $PublicKey.Length))
    Write-Host "🔍 Looking for user with public key: $shortKey..." -ForegroundColor Yellow

    $userId = docker exec -i $PostgresContainer psql -U $DbUser -d $DbName -t -c "SELECT id FROM users WHERE public_key = '$PublicKey';"

    if (-not $userId -or $userId.Trim() -eq "") {
        Write-Host "❌ No user found with that public key" -ForegroundColor Red
        Write-Host "   Make sure the user has registered first" -ForegroundColor Yellow
        exit 1
    }

    $userId = $userId.Trim()

    Write-Host "✅ Found user: $userId" -ForegroundColor Green
    Write-Host "🔄 Promoting to admin..." -ForegroundColor Yellow

    docker exec -i $PostgresContainer psql -U $DbUser -d $DbName -c "UPDATE users SET is_admin = true WHERE id = '$userId';" | Out-Null

    Write-Host ""
    Write-Host "✅ User is now an admin!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. If logged in, logout from the marketplace"
    Write-Host "   2. Login again to get a new token with admin privileges"
    Write-Host "   3. Visit http://localhost:5173/dashboard to see admin features"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Admin bootstrap complete!" -ForegroundColor Green

