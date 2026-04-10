import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export type PhoneCountryOption = {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
};

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function getCountryDisplayName(code: CountryCode): string {
  try {
    const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

export const phoneCountryOptions: PhoneCountryOption[] = getCountries()
  .map((code) => ({
    code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: countryCodeToFlag(code),
    name: getCountryDisplayName(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'es'));