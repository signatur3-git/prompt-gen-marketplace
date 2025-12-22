import AWS from 'aws-sdk';
import { config } from '../config.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Configure S3 client (works with S3-compatible services like Cloudflare R2)
const s3Client = config.s3.endpoint
  ? new AWS.S3({
      endpoint: config.s3.endpoint,
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
      s3ForcePathStyle: true, // Required for some S3-compatible services
      signatureVersion: 'v4',
    })
  : null;

const USE_S3 = !!s3Client;
const LOCAL_STORAGE_PATH = './storage';

/**
 * Store package file
 */
export async function storePackage(
  path: string,
  content: string,
  contentType: string = 'application/x-yaml'
): Promise<void> {
  if (USE_S3) {
    // Store in S3-compatible storage
    await s3Client!.putObject({
      Bucket: config.s3.bucket,
      Key: path,
      Body: content,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year (packages are immutable)
    }).promise();

    console.log(`📦 Stored package in S3: ${path}`);
  } else {
    // Store locally (for development)
    const fullPath = `${LOCAL_STORAGE_PATH}/${path}`;
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf8');
    console.log(`📦 Stored package locally: ${fullPath}`);
  }
}

/**
 * Retrieve package file
 */
export async function retrievePackage(path: string): Promise<string> {
  if (USE_S3) {
    // Retrieve from S3
    const result = await s3Client!.getObject({
      Bucket: config.s3.bucket,
      Key: path,
    }).promise();

    return result.Body!.toString('utf8');
  } else {
    // Retrieve from local storage
    const fullPath = `${LOCAL_STORAGE_PATH}/${path}`;
    return readFileSync(fullPath, 'utf8');
  }
}

/**
 * Check if package file exists
 */
export async function packageExists(path: string): Promise<boolean> {
  if (USE_S3) {
    try {
      await s3Client!.headObject({
        Bucket: config.s3.bucket,
        Key: path,
      }).promise();
      return true;
    } catch {
      return false;
    }
  } else {
    const fullPath = `${LOCAL_STORAGE_PATH}/${path}`;
    return existsSync(fullPath);
  }
}

/**
 * Delete package file (should rarely be used, prefer yanking)
 */
export async function deletePackage(path: string): Promise<void> {
  if (USE_S3) {
    await s3Client!.deleteObject({
      Bucket: config.s3.bucket,
      Key: path,
    }).promise();

    console.log(`🗑️  Deleted package from S3: ${path}`);
  } else {
    const fullPath = `${LOCAL_STORAGE_PATH}/${path}`;
    const fs = await import('fs/promises');
    await fs.unlink(fullPath);
    console.log(`🗑️  Deleted package locally: ${fullPath}`);
  }
}

/**
 * Get presigned download URL (for direct downloads without going through our server)
 */
export async function getDownloadUrl(path: string, expiresIn: number = 3600): Promise<string> {
  if (USE_S3) {
    return s3Client!.getSignedUrlPromise('getObject', {
      Bucket: config.s3.bucket,
      Key: path,
      Expires: expiresIn,
    });
  } else {
    // For local storage, return a path (would need to be served by Express)
    return `/storage/${path}`;
  }
}

/**
 * Initialize storage (create bucket if doesn't exist, create local directory)
 */
export async function initializeStorage(): Promise<void> {
  if (USE_S3) {
    try {
      // Check if bucket exists
      await s3Client!.headBucket({ Bucket: config.s3.bucket }).promise();
      console.log(`✅ S3 bucket exists: ${config.s3.bucket}`);
    } catch {
      console.log(`⚠️  S3 bucket not found, attempting to create: ${config.s3.bucket}`);
      try {
        await s3Client!.createBucket({ Bucket: config.s3.bucket }).promise();
        console.log(`✅ S3 bucket created: ${config.s3.bucket}`);
      } catch (error: any) {
        console.error(`❌ Failed to create S3 bucket: ${error.message}`);
        console.error('   Please create the bucket manually or check credentials');
      }
    }
  } else {
    // Create local storage directory
    if (!existsSync(LOCAL_STORAGE_PATH)) {
      mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
      console.log(`✅ Created local storage directory: ${LOCAL_STORAGE_PATH}`);
    } else {
      console.log(`✅ Local storage directory exists: ${LOCAL_STORAGE_PATH}`);
    }
  }
}

/**
 * Get storage info
 */
export function getStorageInfo(): {
  type: 'S3' | 'Local';
  endpoint?: string;
  bucket?: string;
  path?: string;
} {
  if (USE_S3) {
    return {
      type: 'S3',
      endpoint: config.s3.endpoint,
      bucket: config.s3.bucket,
    };
  } else {
    return {
      type: 'Local',
      path: LOCAL_STORAGE_PATH,
    };
  }
}

