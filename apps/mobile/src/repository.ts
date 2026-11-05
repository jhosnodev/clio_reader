import { LocalRepository } from '@clio-reader/storage';
import { createExpoKVStore } from './bridges/storage';

export function createRepository(): LocalRepository {
  return new LocalRepository(createExpoKVStore());
}
