// Store avatars as data URLs directly instead of using Cloudflare R2
// This eliminates the @aws-sdk/client-s3 dependency

export async function uploadToR2(file: File | Blob, path: string): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return dataUrl;
}
