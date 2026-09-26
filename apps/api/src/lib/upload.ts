import multer from 'multer';
import type { RequestHandler } from 'express';
import { AppError } from './app-error';

// Tipe dicek dari magic bytes, bukan ekstensi/header (ARCHITECTURE §4.6).
const MAGIC = {
  png: { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  pdf: { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
};
type FileType = keyof typeof MAGIC;

/** Satu file (field `file`). `req.file.mimetype` ditimpa dengan tipe hasil deteksi. */
function fileUpload(types: FileType[], maxMb: number, typeMessage: string): RequestHandler {
  const single = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * 1024 * 1024, files: 1 } }).single('file');
  return (req, res, next) =>
    single(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('FILE_TOO_LARGE', `Ukuran file maksimal ${maxMb} MB`, 400));
      }
      if (err) return next(err);
      if (!req.file) return next(new AppError('FILE_REQUIRED', 'File wajib diunggah', 400));
      const type = types.find((t) => req.file!.buffer.subarray(0, MAGIC[t].bytes.length).equals(Buffer.from(MAGIC[t].bytes)));
      if (!type) return next(new AppError('INVALID_FILE_TYPE', typeMessage, 400));
      req.file.mimetype = MAGIC[type].mime;
      next();
    });
}

/** TTD/stempel: PNG maks 2 MB. */
export const pngUpload = fileUpload(['png'], 2, 'File harus berupa gambar PNG');
/** Lampiran MO bertanda tangan: PDF/JPG/PNG maks 10 MB (FR-MO-12). */
export const attachmentUpload = fileUpload(['pdf', 'jpg', 'png'], 10, 'File harus berupa PDF, JPG, atau PNG');
