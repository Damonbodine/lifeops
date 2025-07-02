#!/usr/bin/env node

// Test phone normalization function 
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return { original: phoneNumber, normalized: '', digits: '', last10: '' };
  
  // Remove all non-numeric characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  let normalized = '';
  let last10 = '';
  
  if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code (11 digits starting with 1)
    normalized = digits;
    last10 = digits.slice(1);
  } else if (digits.length === 10) {
    // US number without country code (10 digits)
    normalized = '1' + digits;
    last10 = digits;
  } else if (digits.length > 10) {
    // International or malformed, take last 10 digits
    last10 = digits.slice(-10);
    normalized = '1' + last10;
  } else {
    // Too short, use as-is
    normalized = digits;
    last10 = digits;
  }
  
  return {
    original: phoneNumber,
    normalized: normalized,
    digits: digits,
    last10: last10,
    area: last10.slice(0, 3),
    exchange: last10.slice(3, 6),
    number: last10.slice(6, 10)
  };
}

// Test with sample numbers
const testNumbers = [
  '+16462566056',  // From Messages
  '716-715-5716',  // From Contacts  
  '+13473577328',  // Another Messages number
  '7167155716',    // Digits only
  '(716) 715-5716' // Formatted
];

console.log('🧪 Testing phone number normalization:\n');

testNumbers.forEach(num => {
  const result = normalizePhoneNumber(num);
  console.log(`${num.padEnd(20)} -> last10: ${result.last10} (${result.area}-${result.exchange}-${result.number})`);
});

console.log('\n✅ All numbers should normalize to last 10 digits for comparison');