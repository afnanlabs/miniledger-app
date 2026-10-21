import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { idParamSchema } from '../../schemas/common.schema';
import { createLoanSchema, listLoansQuerySchema } from '../../schemas/loans.schema';
import * as loansController from './loans.controller';

export const loansRouter = Router();

// Every loan endpoint requires a valid JWT.
loansRouter.use(requireAuth);

loansRouter.get('/', validate(listLoansQuerySchema, 'query'), loansController.listLoans);

loansRouter.post('/', validate(createLoanSchema, 'body'), loansController.createLoan);

loansRouter.get('/:id', validate(idParamSchema, 'params'), loansController.getLoan);

loansRouter.patch('/:id/repay', validate(idParamSchema, 'params'), loansController.repayLoan);
