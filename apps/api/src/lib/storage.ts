import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { AppError } from './app-error';
import { logger } from './logger';

// Bucket privat di DigitalOcean Spaces; file diakses lewat signed URL berumur pendek (ARCHITECTURE §4.6).
const SIGNED_URL_TTL_SECONDS = 300;

let client: S3Client | null = null;

function s3() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY } = env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    throw new AppError('STORAGE_NOT_CONFIGURED', 'Storage belum dikonfigurasi. Isi kredensial S3_* di .env', 503);
  }
  client ??= new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  });
  return { client, bucket: S3_BUCKET };
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const { client, bucket } = s3();
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, ACL: 'private' }));
  } catch (err) {
    logger.error({ err, key }, 'upload ke storage gagal');
    throw new AppError('STORAGE_ERROR', 'Gagal mengunggah ke storage. Periksa kredensial & bucket Spaces', 502);
  }
}

/** Isi objek; null bila storage belum dikonfigurasi atau objek tidak bisa dibaca (pemanggil jatuh ke render ulang / tanpa gambar). */
export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const { client, bucket } = s3();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
  } catch (err) {
    if (!(err instanceof AppError)) logger.warn({ err, key }, 'baca storage gagal');
    return null;
  }
}

/** Signed URL untuk key yang ada; null bila key kosong atau storage belum dikonfigurasi. */
export async function signedUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    const { client, bucket } = s3();
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (e) {
    if (e instanceof AppError) return null;
    throw e;
  }
}
