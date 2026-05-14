import { Pool } from "pg";

// Supabase's pooler (aws-0-*.pooler.supabase.com) presents a cert signed by
// an AWS/Supabase intermediate CA that Node's default trust store doesn't
// include. pg-connection-string treats `?sslmode=require` / `verify-ca` as
// `verify-full`, which fails with SELF_SIGNED_CERT_IN_CHAIN and overrides
// any `ssl` option passed to Pool. So we strip sslmode from the URL before
// handing it to pg, and apply our own SSL config explicitly. TLS encryption
// is still on — only CA chain verification is disabled.
// Local dev (Docker Postgres on localhost) runs without SSL.
const rawUrl = process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(rawUrl);

function stripSslmode(url: string): string {
  if (!url) return url;
  // Remove any sslmode=... query param so it can't force verify-full.
  return url
    .replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, pre: string, post: string) =>
      post === "&" ? pre : ""
    )
    .replace(/[?&]$/, "");
}

const pool = new Pool({
  connectionString: stripSslmode(rawUrl),
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Burst headroom: each Function instance can hold up to 20 connections.
  // Cap kept ≤20 because Supabase's transaction pooler tops out around 200
  // total project connections and several Function instances run in parallel.
  max: 20,
  idleTimeoutMillis: 30_000,
});

export default pool;
