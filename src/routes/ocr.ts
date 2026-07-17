import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, ocrDocuments } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { extractDocumentData, parseWithAI, postJournalFromOcr, getOcrDocuments } from '../services/ocr.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError(`Unsupported file type: ${file.mimetype}. Supported: PDF, JPEG, PNG, TIFF`, 400));
    }
  },
});

function uploadToCloudinary(buffer: Buffer, orgId: string, fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `skybooks/ocr/${orgId}`,
        resource_type: 'auto',
        public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')}`,
      },
      (err, result) => {
        if (err) reject(new AppError(`Upload failed: ${err.message}`, 502));
        else resolve(result!.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// POST upload a document for OCR
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) throw new AppError('No file uploaded', 400);

    let fileUrl = '';
    try { fileUrl = await uploadToCloudinary(file.buffer, orgId, file.originalname); }
    catch { fileUrl = ''; }

    const [doc] = await db.insert(ocrDocuments).values({
      orgId,
      fileName: file.originalname,
      fileUrl: fileUrl || `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      fileType: file.mimetype,
      fileSize: file.size,
      status: 'extracting',
      uploadedBy: userId,
    }).returning();

    res.status(201).json({ id: doc.id, status: 'extracting', message: 'Document uploaded, processing...' });

    // Process asynchronously
    const processDoc = async () => {
      try {
        const { text, error } = await extractDocumentData(file.buffer, file.mimetype, orgId, file.originalname);
        if (error) {
          await db.update(ocrDocuments)
            .set({ status: 'error', errorMessage: error })
            .where(eq(ocrDocuments.id, doc.id));
          return;
        }

        const { extracted, suggestedJournal } = await parseWithAI(text, orgId);
        const docTypeRaw = extracted.docType;

        await db.update(ocrDocuments)
          .set({
            status: 'ready',
            docType: docTypeRaw as any,
            extractedData: extracted as any,
            suggestedJournal: suggestedJournal as any,
          })
          .where(eq(ocrDocuments.id, doc.id));

        await createAuditLog({
          orgId, userId, action: 'create', entityType: 'ocr-document',
          entityId: doc.id, newValues: { status: 'ready', docType: docTypeRaw, fileName: file.originalname },
          ...extractReqMeta(req),
        });
      } catch (err: any) {
        await db.update(ocrDocuments)
          .set({ status: 'error', errorMessage: err.message })
          .where(eq(ocrDocuments.id, doc.id));
      }
    };

    processDoc().catch(err => console.error('[OCR] Processing error:', err));
  } catch (err) { next(err); }
});

// GET list OCR documents
router.get('/documents', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { status, docType, page, limit } = req.query as any;
    const result = await getOcrDocuments(orgId, {
      status, docType,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    return res.status(200).json(result);
  } catch (err) { next(err); }
});

// GET single OCR document
router.get('/documents/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [doc] = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.id, req.params.id), eq(ocrDocuments.orgId, orgId)))
      .limit(1);
    if (!doc) throw new AppError('Document not found', 404);
    return res.status(200).json(doc);
  } catch (err) { next(err); }
});

// POST reprocess a document
router.post('/documents/:id/reprocess', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [doc] = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.id, req.params.id), eq(ocrDocuments.orgId, orgId)))
      .limit(1);
    if (!doc) throw new AppError('Document not found', 404);
    if (doc.status === 'posted') throw new AppError('Cannot reprocess a posted document', 400);

    await db.update(ocrDocuments)
      .set({ status: 'pending', errorMessage: null, extractedData: null, suggestedJournal: null })
      .where(eq(ocrDocuments.id, doc.id));

    return res.status(200).json({ id: doc.id, status: 'pending', message: 'Reprocessing queued' });
  } catch (err) { next(err); }
});

// POST confirm OCR and post journal entry
router.post('/documents/:id/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;

    const schema = z.object({
      suggestedJournal: z.object({
      description: z.string(),
      date: z.string(),
      totalDebits: z.number(),
      totalCredits: z.number(),
      lines: z.array(z.object({
        accountCode: z.string(),
        accountName: z.string(),
        debit: z.number(),
        credit: z.number(),
      })),
      }),
    });

    const body = schema.parse(req.body);

    const je = await postJournalFromOcr(req.params.id, orgId, userId, body.suggestedJournal, extractReqMeta(req));
    return res.status(200).json({ journalEntry: je, message: 'Journal entry posted' });
  } catch (err) { next(err); }
});

// DELETE reject/delete an OCR document
router.delete('/documents/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [doc] = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.id, req.params.id), eq(ocrDocuments.orgId, orgId)))
      .limit(1);
    if (!doc) throw new AppError('Document not found', 404);

    await db.delete(ocrDocuments).where(eq(ocrDocuments.id, doc.id));

    await createAuditLog({
      orgId, userId: req.user!.userId, action: 'delete', entityType: 'ocr-document',
      entityId: doc.id, newValues: { fileName: doc.fileName, status: doc.status },
      ...extractReqMeta(req),
    });

    return res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

export default router;
