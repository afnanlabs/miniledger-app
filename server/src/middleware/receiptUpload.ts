import multer from 'multer';
import { AppError } from '../utils/AppError';
import {
  MAX_RECEIPT_BYTES,
  isAllowedReceiptMime,
} from '../storage/receiptStorage';

/**
 * Receipt files are held in memory only until the loan service validates the
 * fields and writes the file. That keeps invalid/unauthenticated requests from
 * creating files on disk. The 5 MB limit caps memory use per request.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RECEIPT_BYTES,
    files: 1,
    fields: 10,
    parts: 12,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedReceiptMime(file.mimetype)) {
      callback(
        new AppError(
          400,
          'UNSUPPORTED_RECEIPT_TYPE',
          'Receipt must be a JPEG, PNG, or WebP image.',
        ),
      );
      return;
    }
    callback(null, true);
  },
});

/** Parses an optional `receipt` field on multipart/form-data requests. */
export const uploadReceipt = upload.single('receipt');
