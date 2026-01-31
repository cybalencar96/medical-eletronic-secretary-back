import { Knex } from 'knex';

/**
 * Creates the appointments table for storing medical appointment records
 * Includes foreign key to patients table and status enum
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('appointments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');
    table.timestamp('scheduled_at').notNullable();
    table
      .enum('status', ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'])
      .notNullable()
      .defaultTo('scheduled');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index('patient_id');
    table.index('scheduled_at');
    table.index('status');
  });
}

/**
 * Drops the appointments table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appointments');
}
