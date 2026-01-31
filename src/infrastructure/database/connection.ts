import knex, { Knex } from 'knex';
import knexConfig from '../../../knexfile';

/**
 * Get the current environment for Knex configuration
 * Defaults to 'development' if NODE_ENV is not set
 */
const environment = process.env.NODE_ENV || 'development';

/**
 * Knex instance configured for the current environment
 * Manages PostgreSQL database connections and query building
 */
const db: Knex = knex(knexConfig[environment]);

/**
 * Gracefully close database connections
 * Should be called during application shutdown
 */
export const closeDatabase = async (): Promise<void> => {
  await db.destroy();
};

export default db;
