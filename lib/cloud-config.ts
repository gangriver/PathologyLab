export function isCloudStorageEnabled(): boolean {
  return process.env.CLOUD_STORAGE === "1";
}
