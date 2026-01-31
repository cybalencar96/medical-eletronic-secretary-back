import { Knex } from 'knex';

/**
 * Creates the escalations table for tracking messages that require human intervention
 * Includes resolution tracking and staff assignment
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('escalations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');
    table.text('message').notNullable();
    table.string('reason', 255).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at').nullable();
    table.string('resolved_by', 255).nullable();

    // Indexes for performance
    table.index('patient_id');
    table.index('resolved_at');
    table.index('created_at');
  });
}

/**
 * Drops the escalations table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('escalations');
}
