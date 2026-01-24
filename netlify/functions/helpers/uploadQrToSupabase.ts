import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const uploadQrToSupabase = async (
  qrBuffer: Buffer,
  eventId: string,
  passId: string
): Promise<string> => {
  const fileName = `event-passes/${eventId}/${passId}.png`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "passes";

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, qrBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    const errorMessage = error.message || "Unknown error";
    console.error("Supabase upload error:", errorMessage);
    throw new Error(`Failed to upload QR: ${errorMessage}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};
