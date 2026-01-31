import { Knex } from 'knex';

/**
 * Creates the notifications_sent table for tracking appointment notifications
 * Prevents duplicate notifications and supports audit trail
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications_sent', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('appointment_id')
      .notNullable()
      .references('id')
      .inTable('appointments')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');
    table.string('type', 50).notNullable();
    table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index('appointment_id');
    table.index('type');
    table.index('sent_at');

    // Unique constraint to prevent duplicate notifications of the same type for the same appointment
    table.unique(['appointment_id', 'type']);
  });
}

/**
 * Drops the notifications_sent table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications_sent');
}
