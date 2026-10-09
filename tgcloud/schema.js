// Database schema.
//
// This bot keeps no state, so there are no tables. If you ever add some, export
// them as named exports (e.g. `export const ... = table(...)`), then run
// `npx tgcloud push` to register the schema and `npx tgcloud migrate` to apply
// it to the database.

import { table, integer, text } from 'sdk/db';

// Uncomment to define your first table:
// export const users = table('users', {
//   id:   integer('id').primaryKey({ autoIncrement: true }),
//   name: text('name').notNull(),
// });
