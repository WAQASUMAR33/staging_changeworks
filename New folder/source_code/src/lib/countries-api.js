// Countries API service using REST Countries API
// https://restcountries.com/

const COUNTRIES_API_BASE = 'https://restcountries.com/v3.1';

// Cache for countries data to avoid repeated API calls
let countriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Flag emoji mapping for common countries
const FLAG_EMOJIS = {
  'US': '🇺🇸', 'CA': '🇨🇦', 'MX': '🇲🇽', 'GB': '🇬🇧', 'AU': '🇦🇺',
  'DE': '🇩🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷',
  'JP': '🇯🇵', 'CN': '🇨🇳', 'IN': '🇮🇳', 'RU': '🇷🇺', 'KR': '🇰🇷',
  'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮',
  'CH': '🇨🇭', 'AT': '🇦🇹', 'BE': '🇧🇪', 'PL': '🇵🇱', 'CZ': '🇨🇿',
  'HU': '🇭🇺', 'RO': '🇷🇴', 'BG': '🇧🇬', 'GR': '🇬🇷', 'PT': '🇵🇹',
  'IE': '🇮🇪', 'IS': '🇮🇸', 'LU': '🇱🇺', 'MT': '🇲🇹', 'CY': '🇨🇾',
  'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹', 'SI': '🇸🇮', 'SK': '🇸🇰',
  'HR': '🇭🇷', 'BA': '🇧🇦', 'RS': '🇷🇸', 'ME': '🇲🇪', 'MK': '🇲🇰',
  'AL': '🇦🇱', 'XK': '🇽🇰', 'MD': '🇲🇩', 'UA': '🇺🇦', 'BY': '🇧🇾',
  'TR': '🇹🇷', 'IL': '🇮🇱', 'SA': '🇸🇦', 'AE': '🇦🇪', 'EG': '🇪🇬',
  'ZA': '🇿🇦', 'NG': '🇳🇬', 'KE': '🇰🇪', 'GH': '🇬🇭', 'MA': '🇲🇦',
  'TN': '🇹🇳', 'DZ': '🇩🇿', 'LY': '🇱🇾', 'SD': '🇸🇩', 'ET': '🇪🇹',
  'UG': '🇺🇬', 'TZ': '🇹🇿', 'ZW': '🇿🇼', 'BW': '🇧🇼', 'NA': '🇳🇦',
  'ZM': '🇿🇲', 'MW': '🇲🇼', 'MZ': '🇲🇿', 'MG': '🇲🇬', 'MU': '🇲🇺',
  'SC': '🇸🇨', 'KM': '🇰🇲', 'DJ': '🇩🇯', 'SO': '🇸🇴', 'ER': '🇪🇷',
  'SS': '🇸🇸', 'CF': '🇨🇫', 'TD': '🇹🇩', 'CM': '🇨🇲', 'NE': '🇳🇪',
  'ML': '🇲🇱', 'BF': '🇧🇫', 'SN': '🇸🇳', 'GM': '🇬🇲', 'GW': '🇬🇼',
  'GN': '🇬🇳', 'SL': '🇸🇱', 'LR': '🇱🇷', 'CI': '🇨🇮', 'TG': '🇹🇬',
  'BJ': '🇧🇯', 'CV': '🇨🇻', 'ST': '🇸🇹', 'GQ': '🇬🇶', 'GA': '🇬🇦',
  'CG': '🇨🇬', 'CD': '🇨🇩', 'AO': '🇦🇴', 'BI': '🇧🇮', 'RW': '🇷🇼',
  'AR': '🇦🇷', 'BO': '🇧🇴', 'CL': '🇨🇱', 'CO': '🇨🇴', 'EC': '🇪🇨',
  'GY': '🇬🇾', 'PY': '🇵🇾', 'PE': '🇵🇪', 'SR': '🇸🇷', 'UY': '🇺🇾',
  'VE': '🇻🇪', 'FK': '🇫🇰', 'GF': '🇬🇫', 'GP': '🇬🇵', 'MQ': '🇲🇶',
  'RE': '🇷🇪', 'YT': '🇾🇹', 'PM': '🇵🇲', 'WF': '🇼🇫', 'NC': '🇳🇨',
  'PF': '🇵🇫', 'VU': '🇻🇺', 'SB': '🇸🇧', 'PG': '🇵🇬', 'FJ': '🇫🇯',
  'KI': '🇰🇮', 'TV': '🇹🇻', 'NR': '🇳🇷', 'PW': '🇵🇼', 'FM': '🇫🇲',
  'MH': '🇲🇭', 'WS': '🇼🇸', 'TO': '🇹🇴', 'NU': '🇳🇺', 'CK': '🇨🇰',
  'NZ': '🇳🇿', 'TH': '🇹🇭', 'VN': '🇻🇳', 'LA': '🇱🇦', 'KH': '🇰🇭',
  'MM': '🇲🇲', 'MY': '🇲🇾', 'SG': '🇸🇬', 'BN': '🇧🇳', 'ID': '🇮🇩',
  'TL': '🇹🇱', 'PH': '🇵🇭', 'TW': '🇹🇼', 'HK': '🇭🇰', 'MO': '🇲🇴',
  'MN': '🇲🇳', 'KZ': '🇰🇿', 'KG': '🇰🇬', 'TJ': '🇹🇯', 'TM': '🇹🇲',
  'UZ': '🇺🇿', 'AF': '🇦🇫', 'PK': '🇵🇰', 'BD': '🇧🇩', 'LK': '🇱🇰',
  'MV': '🇲🇻', 'BT': '🇧🇹', 'NP': '🇳🇵', 'IR': '🇮🇷', 'IQ': '🇮🇶',
  'SY': '🇸🇾', 'LB': '🇱🇧', 'JO': '🇯🇴', 'KW': '🇰🇼', 'QA': '🇶🇦',
  'BH': '🇧🇭', 'OM': '🇴🇲', 'YE': '🇾🇪'
};

/**
 * Get flag emoji for a country code
 * @param {string} code - Country code (e.g., 'US', 'CA')
 * @returns {string} Flag emoji or empty string
 */
function getFlagEmoji(code) {
  return FLAG_EMOJIS[code] || '';
}

/**
 * Fetch all countries with their flags and details
 * @returns {Promise<Array>} Array of country objects
 */
export async function fetchCountries() {
  try {
    // Check if we have valid cached data
    if (countriesCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.log('📋 Using cached countries data');
      return countriesCache;
    }

    console.log('🌍 Fetching countries from REST Countries API...');
    
    const response = await fetch(`${COUNTRIES_API_BASE}/all?fields=name,cca2,cca3,flags,idd`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch countries: ${response.status} ${response.statusText}`);
    }

    const countries = await response.json();
    
    // Transform the data to our format
    const transformedCountries = countries
      .filter(country => country.name && country.cca2 && country.flags) // Filter out invalid entries
      .map(country => ({
        code: country.cca2, // ISO 3166-1 alpha-2 country code
        name: country.name.common, // Common name
        flag: country.flags.svg || country.flags.png, // Flag URL (prefer SVG)
        flagEmoji: getFlagEmoji(country.cca2), // Flag emoji
        flagClass: `fi fi-${country.cca2.toLowerCase()}`, // CSS class for country-flag-icons
        phoneCode: country.idd?.root ? `${country.idd.root}${country.idd.suffixes?.[0] || ''}` : null
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

    // Cache the data
    countriesCache = transformedCountries;
    cacheTimestamp = Date.now();
    
    console.log(`✅ Fetched ${transformedCountries.length} countries successfully`);
    return transformedCountries;
    
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    
    // Return fallback countries if API fails
    return getFallbackCountries();
  }
}

/**
 * Get fallback countries list when API fails
 * @returns {Array} Array of fallback country objects
 */
function getFallbackCountries() {
  console.log('⚠️ Using fallback countries data');
  
  const fallbackCodes = ['US', 'CA', 'MX', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR'];
  const countryNames = {
    'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'GB': 'United Kingdom',
    'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
    'ES': 'Spain', 'BR': 'Brazil'
  };
  const phoneCodes = {
    'US': '+1', 'CA': '+1', 'MX': '+52', 'GB': '+44', 'AU': '+61',
    'DE': '+49', 'FR': '+33', 'IT': '+39', 'ES': '+34', 'BR': '+55'
  };
  
  return fallbackCodes.map(code => ({
    code,
    name: countryNames[code] || code,
    flag: `https://flagcdn.com/${code.toLowerCase()}.svg`,
    flagEmoji: getFlagEmoji(code),
    flagClass: `fi fi-${code.toLowerCase()}`,
    phoneCode: phoneCodes[code] || null
  }));
}

/**
 * Get country by code
 * @param {string} code - Country code (e.g., 'US', 'CA')
 * @returns {Promise<Object|null>} Country object or null if not found
 */
export async function getCountryByCode(code) {
  const countries = await fetchCountries();
  return countries.find(country => country.code === code) || null;
}

/**
 * Search countries by name
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of matching countries
 */
export async function searchCountries(query) {
  const countries = await fetchCountries();
  const lowercaseQuery = query.toLowerCase();
  
  return countries.filter(country => 
    country.name.toLowerCase().includes(lowercaseQuery) ||
    country.code.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get popular countries (commonly used)
 * @returns {Promise<Array>} Array of popular countries
 */
export async function getPopularCountries() {
  const popularCodes = ['US', 'CA', 'MX', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR'];
  const countries = await fetchCountries();
  
  return countries.filter(country => popularCodes.includes(country.code));
}

/**
 * Clear countries cache (useful for testing or forcing refresh)
 */
export function clearCountriesCache() {
  countriesCache = null;
  cacheTimestamp = null;
  console.log('🗑️ Countries cache cleared');
}

/**
 * Get countries grouped by region (optional feature)
 * @returns {Promise<Object>} Countries grouped by region
 */
export async function getCountriesByRegion() {
  try {
    const response = await fetch(`${COUNTRIES_API_BASE}/all?fields=name,cca2,region,flags`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch countries by region: ${response.status}`);
    }

    const countries = await response.json();
    
    const grouped = countries.reduce((acc, country) => {
      if (!country.name || !country.cca2 || !country.flags) return acc;
      
      const region = country.region || 'Other';
      if (!acc[region]) acc[region] = [];
      
      acc[region].push({
        code: country.cca2,
        name: country.name.common,
        flag: country.flags.svg || country.flags.png
      });
      
      return acc;
    }, {});
    
    // Sort countries within each region
    Object.keys(grouped).forEach(region => {
      grouped[region].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return grouped;
    
  } catch (error) {
    console.error('❌ Error fetching countries by region:', error);
    return {};
  }
}

const countriesAPI = {
  fetchCountries,
  getCountryByCode,
  searchCountries,
  getPopularCountries,
  clearCountriesCache,
  getCountriesByRegion
};

export default countriesAPI;
