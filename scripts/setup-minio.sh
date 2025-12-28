#!/bin/bash
# Setup MinIO bucket for local development
# This script creates the required bucket in MinIO after it starts

echo "🪣 Setting up MinIO bucket..."

# Wait for MinIO to be ready
max_attempts=30
attempt=0
ready=false

while [ "$ready" = false ] && [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    echo "Waiting for MinIO to be ready... (attempt $attempt/$max_attempts)"

    if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        ready=true
    else
        sleep 2
    fi
done

if [ "$ready" = false ]; then
    echo "❌ MinIO failed to start after $max_attempts attempts"
    exit 1
fi

echo "✅ MinIO is ready!"

# Install MinIO client if not present
if ! command -v mc &> /dev/null; then
    echo "📥 Downloading MinIO client..."
    curl -o ./mc https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x ./mc
    MC_CMD="./mc"
else
    MC_CMD="mc"
fi

# Configure MinIO alias
echo "⚙️  Configuring MinIO alias..."
$MC_CMD alias set local http://localhost:9000 minioadmin minioadmin123

# Create bucket
echo "🪣 Creating bucket 'prompt-gen-packages'..."
$MC_CMD mb local/prompt-gen-packages --ignore-existing

# Set public read policy (for direct downloads)
echo "🔓 Setting bucket policy..."
cat <<EOF | $MC_CMD anonymous set-json /dev/stdin local/prompt-gen-packages
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
EOF

echo ""
echo "✅ MinIO setup complete!"
echo ""
echo "📝 Add these to your .env file:"
echo "S3_ENDPOINT=http://localhost:9000"
echo "S3_BUCKET=prompt-gen-packages"
echo "S3_ACCESS_KEY=minioadmin"
echo "S3_SECRET_KEY=minioadmin123"
echo "S3_REGION=us-east-1"
echo ""
echo "🌐 MinIO Console: http://localhost:9001"
echo "   Username: minioadmin"
echo "   Password: minioadmin123"

