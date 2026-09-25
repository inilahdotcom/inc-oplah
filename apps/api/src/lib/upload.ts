import multer from 'multer';
import type { RequestHandler } from 'express';
import { AppError } from './app-error';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const single = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single('file');

/** Upload satu file PNG (field `file`, maks 2 MB). Tipe dicek dari magic bytes, bukan ekstensi. */
export const pngUpload: RequestHandler = (req, res, next) =>
  single(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('FILE_TOO_LARGE', 'Ukuran file maksimal 2 MB', 400));
    }
    if (err) return next(err);
    if (!req.file) return next(new AppError('FILE_REQUIRED', 'File wajib diunggah', 400));
    if (!req.file.buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      return next(new AppError('INVALID_FILE_TYPE', 'File harus berupa gambar PNG', 400));
    }
    next();
  });
