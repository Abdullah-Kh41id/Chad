export function generateTestMessage(vision: string[], antiVision: string[]): string {
  if (vision.length > 0) {
    const item = vision[Math.floor(Math.random() * vision.length)];
    return `You will ${item.toLowerCase().replace(/\.$/, '')}.`;
  }
  if (antiVision.length > 0) {
    const bad = antiVision[0];
    return `You won’t get the life you want by ${bad.toLowerCase()}.`;
  }
  return 'You will become the man you wrote down.';
}
