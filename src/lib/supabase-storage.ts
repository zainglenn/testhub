import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "attachments";

let cached: SupabaseClient | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  cached ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function uploadObject(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const body = data instanceof Buffer ? data : Buffer.from(data);
  const { error } = await client()
    .storage.from(BUCKET)
    .upload(key, body, { contentType, upsert: false });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

export async function downloadObject(
  key: string,
): Promise<{ data: ArrayBuffer; contentType: string | null } | null> {
  const { data, error } = await client().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return {
    data: await data.arrayBuffer(),
    contentType: data.type || null,
  };
}

export async function removeObject(key: string): Promise<void> {
  await client()
    .storage.from(BUCKET)
    .remove([key])
    .catch(() => {});
}
