import { Knex } from 'knex';

/**
 * Creates the patients table for storing patient records
 * Includes phone number uniqueness constraint and LGPD consent tracking
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('phone', 20).notNullable().unique();
    table.string('cpf', 11).nullable();
    table.string('name', 255).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('consent_given_at').nullable();

    // Indexes for performance
    table.index('phone');
    table.index('cpf');
  });
}

/**
 * Drops the patients table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patients');
}
