/**
 * Utility functions for formatting values in the application
 */

/**
 * Format a token balance by properly handling different token decimals
 * This is used to display whole numbers for token balances
 *
 * @param value The balance value to format (can be number, string, or bigint)
 * @param symbol Optional token symbol to append
 * @returns Formatted balance string
 */
export function formatBalanceWithoutDecimals(
  value: number | string | bigint | undefined,
  symbol?: string
): string {
  if (value === undefined || value === null) return symbol ? `0 ${symbol}` : '0';

  // Convert to number
  let numValue: number;
  if (typeof value === 'bigint') {
    numValue = Number(value);
  } else if (typeof value === 'string') {
    numValue = Number(value);
  } else {
    numValue = value;
  }

  // Handle NaN
  if (Number.isNaN(numValue)) return symbol ? `0 ${symbol}` : '0';

  // Determine decimals based on token symbol
  let decimals = 2; // Default for IDRX

  if (symbol) {
    switch (symbol.toUpperCase()) {
      case 'ETH':
      case 'SEPETH':
      case 'LSKETH':
        decimals = 18;
        break;
      case 'USDC':
        decimals = 6;
        break;
      case 'IDRX':
        decimals = 2;
        break;
      default:
        decimals = 18; // Default to 18 for unknown tokens
    }
  }

  // Format based on decimals
  let formattedValue: string;

  if (decimals === 2) {
    // For IDRX: Remove last two digits by dividing by 100 and rounding down
    const wholeNumber = Math.floor(numValue / 100);
    formattedValue = wholeNumber.toString();
  } else if (decimals === 18) {
    // For ETH: Format with 4 decimal places for better readability
    const ethValue = numValue / 10**18;
    formattedValue = ethValue.toFixed(4);
    // Remove trailing zeros
    formattedValue = formattedValue.replace(/\.?0+$/, '');
  } else if (decimals === 6) {
    // For USDC: Format with 2 decimal places
    const usdcValue = numValue / 10**6;
    formattedValue = usdcValue.toFixed(2);
    // Remove trailing zeros
    formattedValue = formattedValue.replace(/\.?0+$/, '');
  } else {
    // Generic case
    const tokenValue = numValue / 10**decimals;
    formattedValue = tokenValue.toFixed(4);
    // Remove trailing zeros
    formattedValue = formattedValue.replace(/\.?0+$/, '');
  }

  // Return formatted string with optional symbol
  return symbol ? `${formattedValue} ${symbol}` : formattedValue;
}

/**
 * Format a token balance for display in the UI
 * This is a more general formatting function that can be used for different display needs
 *
 * @param value The balance value to format
 * @param options Formatting options
 * @returns Formatted balance string
 */
export function formatTokenBalance(
  value: number | string | bigint | undefined,
  options: {
    symbol?: string;
    removeDecimals?: boolean;
    precision?: number;
    showPlusSign?: boolean;
    decimals?: number;
  } = {}
): string {
  const {
    symbol,
    removeDecimals = false,
    precision = 2,
    showPlusSign = false,
    decimals: explicitDecimals
  } = options;

  if (value === undefined || value === null) return symbol ? `0 ${symbol}` : '0';

  // Convert to number
  let numValue: number;
  if (typeof value === 'bigint') {
    numValue = Number(value);
  } else if (typeof value === 'string') {
    numValue = Number(value);
  } else {
    numValue = value;
  }

  // Handle NaN
  if (Number.isNaN(numValue)) return symbol ? `0 ${symbol}` : '0';

  // Determine decimals based on token symbol if not explicitly provided
  let decimals = explicitDecimals;

  if (decimals === undefined && symbol) {
    switch (symbol.toUpperCase()) {
      case 'ETH':
      case 'SEPETH':
      case 'LSKETH':
        decimals = 18;
        break;
      case 'USDC':
        decimals = 6;
        break;
      case 'IDRX':
        decimals = 2;
        break;
      default:
        decimals = 18; // Default to 18 for unknown tokens
    }
  } else if (decimals === undefined) {
    decimals = 18; // Default to 18 if no symbol and no explicit decimals
  }

  // Format based on options
  let formattedValue: string;

  if (removeDecimals) {
    if (decimals === 2) {
      // For IDRX: Remove last two digits by dividing by 100 and rounding down
      const wholeNumber = Math.floor(numValue / 100);
      formattedValue = wholeNumber.toString();
    } else {
      // For other tokens: Convert to whole units and display without decimals
      const tokenValue = numValue / 10**decimals;
      formattedValue = Math.floor(tokenValue).toString();
    }
  } else {
    // Apply appropriate formatting based on token type
    if (decimals === 18) {
      // For ETH: Format with appropriate precision
      const ethValue = numValue / 10**18;
      formattedValue = ethValue.toFixed(precision);
    } else if (decimals === 6) {
      // For USDC: Format with appropriate precision
      const usdcValue = numValue / 10**6;
      formattedValue = usdcValue.toFixed(precision);
    } else if (decimals === 2) {
      // For IDRX: Format with appropriate precision
      const idrxValue = numValue / 10**2;
      formattedValue = idrxValue.toFixed(precision);
    } else {
      // Generic case
      const tokenValue = numValue / 10**decimals;
      formattedValue = tokenValue.toFixed(precision);
    }

    // Remove trailing zeros
    formattedValue = formattedValue.replace(/\.?0+$/, '');
    // If we removed everything after the decimal point, ensure we have a whole number
    if (formattedValue.endsWith('.')) {
      formattedValue = formattedValue.slice(0, -1);
    }
  }

  // Add plus sign for positive values if requested
  if (showPlusSign && numValue > 0) {
    formattedValue = `+${formattedValue}`;
  }

  // Add symbol if provided
  if (symbol) {
    formattedValue = `${formattedValue} ${symbol}`;
  }

  return formattedValue;
}
