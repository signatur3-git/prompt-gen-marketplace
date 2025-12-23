param(
  [switch]$SkipBuild,
  [switch]$SkipUnit,
  [switch]$SkipIntegration
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Exec($cmd) {
  Write-Host "`n> $cmd`n" -ForegroundColor Cyan
  iex $cmd
}

# Use a dedicated project name and compose file so it never conflicts with manual dev stacks.
$composeFile = Join-Path $root 'docker-compose.ci.yml'
$projectName = 'marketplace-ci'

function GetPublishedPort([string]$service, [int]$containerPort) {
  # Example output: "0.0.0.0:55432" or ":::55432"
  $out = (docker compose -p $projectName -f $composeFile port $service $containerPort) 2>$null
  if (-not $out) {
    throw "Could not determine published port for ${service}:${containerPort}. Is the compose stack running?"
  }
  $line = ($out | Select-Object -First 1)
  if ($line -match ':(\d+)\s*$') {
    return [int]$Matches[1]
  }
  throw "Unexpected port output for ${service}:${containerPort}: $line"
}

try {
  # Clean up any previous CI stack (non-fatal if nothing is running).
  try { Exec "docker compose -p $projectName -f `"$composeFile`" down -v" } catch { }

  Exec "docker compose -p $projectName -f `"$composeFile`" up -d --wait"

  $pgPort = GetPublishedPort 'postgres' 5432
  $redisPort = GetPublishedPort 'redis' 6379

  Exec "npm ci"

  # Ensure integration DB is migrated (fresh DB on every run).
  $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:$pgPort/prompt_gen_marketplace"
  Exec "npm run migrate:up"

  Exec "npm run format:check"
  Exec "npm run lint"
  Exec "npm run lint:frontend"
  Exec "npm run type-check"
  Exec "npm run type-check:frontend"

  if (-not $SkipUnit) {
    Exec "npm test -- --run"
  }

  if (-not $SkipBuild) {
    Exec "npm run build"
    Exec "npm run build:frontend"
  }

  if (-not $SkipIntegration) {
    $env:NODE_ENV = 'test'
    $env:REDIS_URL = "redis://localhost:$redisPort"
    $env:JWT_SECRET = 'test-jwt-secret-for-ci-only'
    $env:JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-ci-only'

    Exec "npm run test:integration -- --run"
  }

  Write-Host "`n✅ Local CI-parity validation PASSED`n" -ForegroundColor Green
}
finally {
  # Always tear down containers to avoid conflicts.
  try { Exec "docker compose -p $projectName -f `"$composeFile`" down -v" } catch { }
}
