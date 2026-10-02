import countryToCurrency from "country-to-currency";

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countries = Object.entries(countryToCurrency)
  .map(([code, currency]) => ({
    code,
    currency,
    name: countryDisplayNames.of(code) ?? code,
  }))
  .filter((country) => country.name !== country.code)
  .sort((left, right) => {
    if (left.code === "NG") return -1;
    if (right.code === "NG") return 1;
    return left.name.localeCompare(right.name);
  });

const countryByCode = new Map(countries.map((country) => [country.code, country]));

export const getCurrencyForCountry = (countryCode: unknown) => {
  if (typeof countryCode !== "string") return "NGN";
  return countryByCode.get(countryCode.toUpperCase())?.currency ?? "NGN";
};

export const getCountryName = (countryCode: string) =>
  countryByCode.get(countryCode.toUpperCase())?.name ?? "your country";
