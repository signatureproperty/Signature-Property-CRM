import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a phone number based on the selected country code.
 * - Detects if the number already has an international prefix starting with '+'.
 * - Removes leading '0' if the country code is '+92'.
 * - Prepends the selected country code correctly if not already present.
 */
export function formatPhoneNumber(phone: string, countryCode: string = '+92'): string {
  if (!phone) return '';
  
  // Clean leading/trailing spaces
  let cleaned = phone.trim();
  
  // If it already starts with '+', it's already a full international number. 
  // We return as is to support any country without interference.
  if (cleaned.startsWith('+')) {
    // Just remove spaces and dashes
    return cleaned.replace(/[\s-]/g, '');
  }

  // Remove any non-digit characters for processing
  let digits = cleaned.replace(/\D/g, '');
  const codeWithoutPlus = countryCode.replace('+', '');

  // If the number already starts with the digits of the selected country code, 
  // we just prepend the '+' and return.
  if (digits.startsWith(codeWithoutPlus)) {
    return `+${digits}`;
  }

  // For Pakistan (+92), if number starts with local '0', remove it before prepending code.
  if (countryCode === '+92' && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Combine the country code and the cleaned digits
  return `${countryCode}${digits}`;
}
