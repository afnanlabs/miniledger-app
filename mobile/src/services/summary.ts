import { apiRequest } from './api';
import type { Summary } from '../types';

export const summaryService = {
  get(): Promise<Summary> {
    return apiRequest<Summary>('/summary');
  },
};
