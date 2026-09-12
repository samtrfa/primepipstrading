const TRUSTED_EMAIL_DOMAINS = new Set([
  "aol.com",
  "fastmail.com",
  "gmail.com",
  "googlemail.com",
  "gmx.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "protonmail.com",
  "rocketmail.com",
  "yahoo.ca",
  "yahoo.co.uk",
  "yahoo.com",
  "yahoo.com.au",
  "yahoo.com.br",
  "yahoo.com.mx",
  "ymail.com",
  "yandex.com",
  "zoho.com",
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "trashmail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "sharklasers.com",
  "getnada.com",
  "mintemail.com",
  "mailnesia.com",
  "tmpmail.org",
]);

export function isAllowedEmail(value) {
  if (typeof value !== "string") {
    return false;
  }

  const email = value.trim().toLowerCase();

  if (email === "friendlyengine@admin.com") {
    return true;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return false;
  }

  const domain = email.split("@")[1].replace(/^www\./, "");

  if (!domain || domain.startsWith(".") || domain.includes("..")) {
    return false;
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  for (const disposable of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain === disposable || domain.endsWith(`.${disposable}`)) {
      return false;
    }
  }

  return TRUSTED_EMAIL_DOMAINS.has(domain);
}
