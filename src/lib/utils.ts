
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a phone number based on the selected country code.
 * - Detects if the number already has an international prefix.
 * - Removes leading '0' if the country code is '+92'.
 * - Prepends the selected country code correctly.
 * @param phone The raw phone number string.
 * @param countryCode The selected country code (e.g., '+92').
 * @returns The formatted phone number string.
 */
export function formatPhoneNumber(phone: string, countryCode: string = '+92'): string {
  if (!phone) return '';
  
  // Clean all non-digit characters except '+'
  let cleaned = phone.trim();
  
  // If it already starts with '+', assume it's already fully formatted
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Remove any non-digit characters for processing
  let digits = cleaned.replace(/\D/g, '');
  const codeWithoutPlus = countryCode.replace('+', '');

  // If the number already starts with the provided country code, don't prepend it again
  if (digits.startsWith(codeWithoutPlus)) {
    return `+${digits}`;
  }

  // For Pakistan (+92), if number starts with '0', remove it
  if (countryCode === '+92' && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Combine the country code and the cleaned digits
  return `${countryCode}${digits}`;
}
