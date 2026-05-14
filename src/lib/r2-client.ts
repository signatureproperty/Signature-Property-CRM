
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
 * Uploads a file to Cloudflare R2 and returns a presumed public URL.
 * Note: Constructing the public URL depends on your R2 bucket being public
 * or having a custom domain configured.
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
    
    // Construction of the URL. 
    // Using the account-specific endpoint format. 
    // If you have a custom domain or r2.dev subdomain, this would be updated accordingly.
    // Standard format for direct public access if enabled:
    return `https://889826ecda9570b1a561c1722b044e1d.r2.cloudflarestorage.com/${BUCKET_NAME}/${path}`;
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw new Error("Failed to upload image to R2.");
  }
}
