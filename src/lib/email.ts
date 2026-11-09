// 前後端共用的 email 驗證規則
export const MAX_EMAIL_LENGTH = 254;
// 一般常見的 email 格式：帳號@網域.頂級網域，不允許空白
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(e);
}
