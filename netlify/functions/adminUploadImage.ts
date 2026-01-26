import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

// Initialize Supabase client with service role key for storage operations
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Allowed image types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// SECURITY: Allowed folder names (whitelist)
const ALLOWED_FOLDERS = ["classes", "events", "general", "profiles"];
// SECURITY: Sanitize file names to prevent path traversal
const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9._-]/g;
const MAX_FILENAME_LENGTH = 100;

export const handler: Handler = async (event) => {
  const headers = getAdminHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  // Verify admin session
  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    // Handle base64 encoded image in JSON body
    const body = JSON.parse(event.body || "{}");
    const { image, fileName, folder = "classes" } = body;

    if (!image || !fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Image and fileName are required",
        }),
      };
    }

    // SECURITY: Validate folder against whitelist to prevent path traversal
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}`,
        }),
      };
    }

    // SECURITY: Sanitize fileName to prevent path traversal
    const sanitizedFileName = String(fileName)
      .slice(0, MAX_FILENAME_LENGTH)
      .replace(FILENAME_SANITIZE_REGEX, "_")
      .replace(/\.{2,}/g, "."); // Remove double dots
    
    if (sanitizedFileName.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid fileName",
        }),
      };
    }

    // Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Check file size
    if (buffer.length > MAX_SIZE) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Image size must be less than 5MB",
        }),
      };
    }

    // Detect mime type from base64 header
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF",
        }),
      };
    }

    // Generate unique file name using sanitized filename
    const extension = mimeType.split("/")[1];
    const uniqueFileName = `${folder}/${Date.now()}-${sanitizedFileName.replace(/\.[^/.]+$/, "")}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("Assets")
      .upload(uniqueFileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Failed to upload image: " + error.message,
        }),
      };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("Assets")
      .getPublicUrl(data.path);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          url: publicUrlData.publicUrl,
          path: data.path,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Upload image error:", errorMessage);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to upload image",
      }),
    };
  }
};
