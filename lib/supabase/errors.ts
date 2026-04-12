function getSupabaseErrorText(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "";
}

export function getSupabaseTableErrorMessage(error: unknown, fallback: string) {
  const message = getSupabaseErrorText(error);

  if (/recipient_address|chain_id/i.test(message) || /column .* does not exist/i.test(message)) {
    return "Your Supabase payments schema is out of date. Re-run supabase/schema.sql in the Supabase SQL Editor so the new recipient_address and chain_id columns are added, then refresh and try again.";
  }

  if (/schema cache/i.test(message) || /relation .* does not exist/i.test(message) || /function .* does not exist/i.test(message) || /could not find the function/i.test(message)) {
    return "Supabase commerce tables are not set up yet. Run supabase/schema.sql in the Supabase SQL Editor, then refresh and try again.";
  }

  return message || fallback;
}
