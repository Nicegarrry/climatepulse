import { Pool } from "pg";

// Supabase's pooler (aws-0-*.pooler.supabase.com) presents a cert signed by
// an AWS/Supabase intermediate CA that Node's default trust store doesn't
// include. pg-connection-string treats `?sslmode=require` as `verify-full`,
// which then fails with SELF_SIGNED_CERT_IN_CHAIN. Fix by disabling strict
// CA verification for the DB connection only — TLS encryption is still on.
// Local dev (Docker Postgres on localhost) runs without SSL, so keep it off
// there.
const connectionString = process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export default pool;
