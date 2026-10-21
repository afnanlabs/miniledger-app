import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as summaryController from './summary.controller';

export const summaryRouter = Router();

summaryRouter.use(requireAuth);

summaryRouter.get('/', summaryController.getSummary);
