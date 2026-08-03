import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// This file only owns the connection pool.
// Table creation lives in auth.controller.js (initAuthTables) so there is
// a single source of truth for the schema instead of two competing
// CREATE TABLE statements racing on import.
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT || 5432,
});

export default pool;