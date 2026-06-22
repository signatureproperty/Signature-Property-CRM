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

  let cleaned = phone.trim();

  // Handle Excel ="..." format
  if (cleaned.startsWith('=')) {
    const match = cleaned.match(/="(.+?)"/);
    if (match) cleaned = match[1];
  }

  // Handle Excel scientific notation (e.g., 4.47878E+11)
  if (/^\d*\.?\d+E[+-]\d+$/i.test(cleaned)) {
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      cleaned = parsed.toString();
    }
  }

  // If it already starts with '+', clean spaces/dashes and return
  if (cleaned.startsWith('+')) {
    return cleaned.replace(/[\s-]/g, '');
  }

  // Remove all non-digit characters (spaces, dashes, brackets, dots)
  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  const codeWithoutPlus = countryCode.replace('+', '');

  // If already starts with country code digits
  if (digits.startsWith(codeWithoutPlus)) {
    return `+${digits}`;
  }

  // Auto-detect country code if not matching default (+92)
  const autoDetectCode = (d: string): string | null => {
    if (d.startsWith('1') && d.length === 11) return '+1';
    if (d.startsWith('44') && d.length >= 11 && d.length <= 13) return '+44';
    if (d.startsWith('971') && d.length >= 11 && d.length <= 13) return '+971';
    if (d.startsWith('966') && d.length >= 11 && d.length <= 13) return '+966';
    if (d.startsWith('973') && d.length === 10) return '+973';
    return null;
  };

  const detectedCode = autoDetectCode(digits);

  // For Pakistan (+92), handle leading '0'
  if (countryCode === '+92' && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  if (detectedCode) {
    return `+${digits}`;
  }

  return `${countryCode}${digits}`;
}
