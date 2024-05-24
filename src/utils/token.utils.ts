export function generateToken() {
  const length = 32;
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0, n = charset.length; i < length; ++i) {
    token += charset.charAt(Math.floor(Math.random() * n));
  }

  return token;
}
