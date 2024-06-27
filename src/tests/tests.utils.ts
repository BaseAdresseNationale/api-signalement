import { Model, Types } from 'mongoose';

const _createdAt = new Date('2000-01-01').getTime();
const _updatedAt = new Date('2000-01-02').getTime();

export async function createRecording<T>(
  model: Model<T>,
  props: Partial<T> = {},
): Promise<T> {
  const _id = new Types.ObjectId();
  const recording: Partial<T> = {
    _id,
    _createdAt,
    _updatedAt,
    _deletedAt: null,
    ...props,
  };
  await model.create(recording);

  return model.findById(_id).lean();
}
