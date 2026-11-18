export function validOpportunityScreenshot(bytes, type) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > 5 * 1024 * 1024) return false;
  if (type === "image/png") return [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  return false;
}
