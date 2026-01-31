import { Knex } from 'knex';

/**
 * Creates the audit_logs table for LGPD compliance and activity tracking
 * Uses JSONB column for flexible payload storage
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');
    table.string('action', 100).notNullable();
    table.jsonb('payload').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index('patient_id');
    table.index('action');
    table.index('created_at');
  });
}

/**
 * Drops the audit_logs table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
