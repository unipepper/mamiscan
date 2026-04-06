export function getTossBasicAuth(): string {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error('TOSS_SECRET_KEY is not set');
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}
