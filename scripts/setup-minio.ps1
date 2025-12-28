# Setup MinIO bucket for local development
# This script creates the required bucket in MinIO after it starts

Write-Host "🪣 Setting up MinIO bucket..." -ForegroundColor Cyan

# Wait for MinIO to be ready
$maxAttempts = 30
$attempt = 0
$ready = $false

while (-not $ready -and $attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "Waiting for MinIO to be ready... (attempt $attempt/$maxAttempts)"

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -Method GET -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "❌ MinIO failed to start after $maxAttempts attempts" -ForegroundColor Red
    exit 1
}

Write-Host "✅ MinIO is ready!" -ForegroundColor Green

# Install MinIO client if not present
$mcPath = "mc.exe"
if (-not (Get-Command $mcPath -ErrorAction SilentlyContinue)) {
    Write-Host "📥 Downloading MinIO client..." -ForegroundColor Yellow
    $mcUrl = "https://dl.min.io/client/mc/release/windows-amd64/mc.exe"
    Invoke-WebRequest -Uri $mcUrl -OutFile "$PSScriptRoot\mc.exe"
    $mcPath = "$PSScriptRoot\mc.exe"
}

# Configure MinIO alias
Write-Host "⚙️  Configuring MinIO alias..." -ForegroundColor Cyan
& $mcPath alias set local http://localhost:9000 minioadmin minioadmin123

# Create bucket
Write-Host "🪣 Creating bucket 'prompt-gen-packages'..." -ForegroundColor Cyan
& $mcPath mb local/prompt-gen-packages --ignore-existing

# Set public read policy (for direct downloads)
Write-Host "🔓 Setting bucket policy..." -ForegroundColor Cyan
$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::prompt-gen-packages/*"]
    }
  ]
}
"@

$policy | & $mcPath anonymous set-json /dev/stdin local/prompt-gen-packages

Write-Host ""
Write-Host "✅ MinIO setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Add these to your .env file:" -ForegroundColor Yellow
Write-Host "S3_ENDPOINT=http://localhost:9000"
Write-Host "S3_BUCKET=prompt-gen-packages"
Write-Host "S3_ACCESS_KEY=minioadmin"
Write-Host "S3_SECRET_KEY=minioadmin123"
Write-Host "S3_REGION=us-east-1"
Write-Host ""
Write-Host "🌐 MinIO Console: http://localhost:9001" -ForegroundColor Cyan
Write-Host "   Username: minioadmin"
Write-Host "   Password: minioadmin123"

