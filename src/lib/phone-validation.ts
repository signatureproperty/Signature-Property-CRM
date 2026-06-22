export interface PhoneIssue {
  severity: 'error' | 'warning';
  message: string;
}

export function validatePhone(phone: string): PhoneIssue | null {
  if (!phone) return { severity: 'error', message: 'Phone number is empty' };

  const cleaned = phone.replace(/[\s-]/g, '');

  if (/^\+?\d*\.?\d+E[+-]\d+$/i.test(cleaned)) {
    return { severity: 'error', message: 'Excel scientific notation — number is corrupted. Original value may be lost.' };
  }

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 8) {
    return { severity: 'error', message: `Too short (${digits.length} digits). A valid number needs at least 8 digits.` };
  }
  if (digits.length > 15) {
    return { severity: 'error', message: `Too long (${digits.length} digits). Max valid length is 15 digits.` };
  }
  if (/^0{7,}$/.test(digits)) {
    return { severity: 'error', message: 'Number consists of all zeros — likely invalid.' };
  }

  if (cleaned.startsWith('+')) {
    if (!/^\+\d+$/.test(cleaned)) {
      return { severity: 'warning', message: 'Has "+" prefix but contains unexpected characters.' };
    }
    return null;
  }

  if (digits.startsWith('0') && digits.length <= 11 && digits.length >= 10) {
    return null;
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return null;
  }
  if (digits.startsWith('92') && digits.length >= 11 && digits.length <= 13) {
    return null;
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return null;
  }
  if (digits.startsWith('44') && digits.length >= 11 && digits.length <= 13) {
    return null;
  }
  if (digits.startsWith('971') && digits.length >= 11 && digits.length <= 13) {
    return null;
  }

  if (/\s/.test(phone)) {
    return { severity: 'warning', message: 'Has spaces inside — may cause formatting issues.' };
  }

  return { severity: 'warning', message: `Unusual format (${digits.length} digits). Verify the number is correct.` };
}
