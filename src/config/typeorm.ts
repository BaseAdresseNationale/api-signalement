import { registerAs } from '@nestjs/config';
import { config as dotenvConfig } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { entities } from '../app.entities';
import { migrations } from '../migrations';

dotenvConfig({ path: '.env' });

const typeORMConfig = {
  type: 'postgres',
  url: `${process.env.POSTGRES_URL}`,
  keepConnectionAlive: true,
  schema: 'public',
  migrationsRun: false,
  synchronize: false,
  migrations,
  entities,
};

export default registerAs('typeorm', () => typeORMConfig);

export const connectionSource = new DataSource(
  typeORMConfig as DataSourceOptions,
);
