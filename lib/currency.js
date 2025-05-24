// Currency utilities for formatting and parsing

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
];

// Default currency - you can change this
export const DEFAULT_CURRENCY = 'USD';

// Get currency info by code
export const getCurrency = (code) => {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES.find(c => c.code === DEFAULT_CURRENCY);
};

// Format number with commas (e.g., 1,234.56)
export const formatNumberWithCommas = (value) => {
  if (!value && value !== 0) return '';
  
  // Convert to string and remove any existing commas
  const cleanValue = value.toString().replace(/,/g, '');
  
  // Check if it's a valid number
  if (isNaN(cleanValue)) return value;
  
  // Split by decimal point
  const parts = cleanValue.split('.');
  
  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Return with decimal part if it exists
  return parts.join('.');
};

// Remove commas from a formatted number
export const parseNumberFromFormatted = (formattedValue) => {
  if (!formattedValue) return '';
  return formattedValue.toString().replace(/,/g, '');
};

// Format currency display (e.g., $1,234.56)
export const formatCurrency = (amount, currencyCode = DEFAULT_CURRENCY) => {
  const currency = getCurrency(currencyCode);
  const formattedAmount = formatNumberWithCommas(amount);
  
  // Handle different currency symbol positions
  if (['EUR', 'NOK', 'SEK', 'DKK', 'PLN'].includes(currencyCode)) {
    return `${formattedAmount} ${currency.symbol}`;
  }
  
  return `${currency.symbol}${formattedAmount}`;
};

// Validate if input is a valid number
export const isValidAmount = (value) => {
  if (!value) return false;
  const cleanValue = parseNumberFromFormatted(value);
  const num = parseFloat(cleanValue);
  return !isNaN(num) && num > 0;
};

// Get user's likely currency based on locale
export const detectUserCurrency = () => {
  try {
    const locale = navigator.language || 'en-US';
    const country = locale.split('-')[1];
    
    const currencyMap = {
      'US': 'USD', 'CA': 'CAD', 'GB': 'GBP', 'AU': 'AUD',
      'JP': 'JPY', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR',
      'ES': 'EUR', 'NL': 'EUR', 'BE': 'EUR', 'AT': 'EUR',
      'CH': 'CHF', 'CN': 'CNY', 'IN': 'INR', 'KR': 'KRW',
      'BR': 'BRL', 'MX': 'MXN', 'SG': 'SGD', 'HK': 'HKD',
      'NO': 'NOK', 'SE': 'SEK', 'DK': 'DKK', 'PL': 'PLN',
      'RU': 'RUB', 'TR': 'TRY', 'ZA': 'ZAR', 'VN': 'VND'
    };
    
    return currencyMap[country] || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
};