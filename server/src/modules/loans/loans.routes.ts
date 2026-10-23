import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { uploadReceipt } from '../../middleware/receiptUpload';
import { idParamSchema } from '../../schemas/common.schema';
import { createLoanSchema, listLoansQuerySchema, updateLoanSchema } from '../../schemas/loans.schema';
import * as loansController from './loans.controller';

export const loansRouter = Router();

// Every loan endpoint requires a valid JWT.
loansRouter.use(requireAuth);

loansRouter.get('/', validate(listLoansQuerySchema, 'query'), loansController.listLoans);

// Authentication runs before multer, so an unauthenticated request is rejected
// without buffering or writing an upload.
loansRouter.post(
  '/',
  uploadReceipt,
  validate(createLoanSchema, 'body'),
  loansController.createLoan,
);

loansRouter.get('/:id', validate(idParamSchema, 'params'), loansController.getLoan);

loansRouter.get(
  '/:id/receipt',
  validate(idParamSchema, 'params'),
  loansController.getLoanReceipt,
);

loansRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateLoanSchema, 'body'),
  loansController.updateLoan,
);

loansRouter.delete('/:id', validate(idParamSchema, 'params'), loansController.deleteLoan);

loansRouter.patch('/:id/repay', validate(idParamSchema, 'params'), loansController.repayLoan);
