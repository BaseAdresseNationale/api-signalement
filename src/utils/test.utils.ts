import { Repository } from 'typeorm';

export async function createRecording<T>(
  repository: Repository<T>,
  entity: T,
): Promise<T> {
  return repository.save(entity);
}
