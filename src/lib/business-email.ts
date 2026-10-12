const personalDomains = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in", "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com", "rediffmail.com", "gmx.com", "mail.com", "yandex.com", "yandex.ru", "ymail.com", "hotmail.co.uk", "outlook.in", "qq.com", "163.com", "126.com", "tuta.com", "tutanota.com", "pm.me", "fastmail.com", "hey.com", "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
]);
export function isBusinessEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !personalDomains.has(domain);
}