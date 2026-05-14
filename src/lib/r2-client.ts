
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Standard S3 compatible client for Cloudflare R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: "https://889826ecda9570b1a561c1722b044e1d.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "78d6a995f8e62dc0c9545e1209a5893b",
    secretAccessKey: "e8828cf720b2ee57def95b18c9cb7192a8f42d32ce02713906a1143c6225c207",
  },
});

export const BUCKET_NAME = "signature-crm-assets";

/**
 * Uploads a file to Cloudflare R2 and returns a path-style URL.
 * Note: To view this in browser, Public Access or a Custom Domain must be enabled on R2.
 */
export async function uploadToR2(file: File, path: string): Promise<string> {
  const fileArrayBuffer = await file.arrayBuffer();
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
    Body: new Uint8Array(fileArrayBuffer),
    ContentType: file.type,
  });

  try {
    await r2Client.send(command);
    
    // Constructing the S3-compatible path-style URL.
    // For direct public viewing, the user should ideally configure an r2.dev subdomain.
    return `https://889826ecda9570b1a561c1722b044e1d.r2.cloudflarestorage.com/${BUCKET_NAME}/${path}`;
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw new Error("Failed to upload image to R2.");
  }
}
