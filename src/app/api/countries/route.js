import { NextResponse } from "next/server";
import { corsHeaders } from '@/app/lib/cors';

// Function to get flag emoji from country code
const getFlagEmoji = (countryCode) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Comprehensive list of countries with ISO codes and flags
const countries = [
  { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "AI", name: "Anguilla", flag: "🇦🇮" },
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AQ", name: "Antarctica", flag: "🇦🇶" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AS", name: "American Samoa", flag: "🇦🇸" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AW", name: "Aruba", flag: "🇦🇼" },
  { code: "AX", name: "Aland Islands", flag: "🇦🇽" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "BI", name: "Burundi", flag: "🇧🇮" },
  { code: "BJ", name: "Benin", flag: "🇧🇯" },
  { code: "BL", name: "Saint Barthelemy", flag: "🇧🇱" },
  { code: "BM", name: "Bermuda", flag: "🇧🇲" },
  { code: "BN", name: "Brunei Darussalam", flag: "🇧🇳" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba", flag: "🇧🇶" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" },
  { code: "BV", name: "Bouvet Island", flag: "🇧🇻" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BY", name: "Belarus", flag: "🇧🇾" },
  { code: "BZ", name: "Belize", flag: "🇧🇿" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CC", name: "Cocos (Keeling) Islands", flag: "🇨🇨" },
  { code: "CD", name: "Congo, Democratic Republic of the", flag: "🇨🇩" },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "CI", name: "Cote d'Ivoire", flag: "🇨🇮" },
  { code: "CK", name: "Cook Islands", flag: "🇨🇰" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "CV", name: "Cape Verde", flag: "🇨🇻" },
  { code: "CW", name: "Curacao", flag: "🇨🇼" },
  { code: "CX", name: "Christmas Island", flag: "🇨🇽" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DM", name: "Dominica", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "EH", name: "Western Sahara", flag: "🇪🇭" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FJ", name: "Fiji", flag: "🇫🇯" },
  { code: "FK", name: "Falkland Islands (Malvinas)", flag: "🇫🇰" },
  { code: "FM", name: "Micronesia, Federated States of", flag: "🇫🇲" },
  { code: "FO", name: "Faroe Islands", flag: "🇫🇴" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "GD", name: "Grenada", flag: "🇬🇩" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "GF", name: "French Guiana", flag: "🇬🇫" },
  { code: "GG", name: "Guernsey", flag: "🇬🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GI", name: "Gibraltar", flag: "🇬🇮" },
  { code: "GL", name: "Greenland", flag: "🇬🇱" },
  { code: "GM", name: "Gambia", flag: "🇬🇲" },
  { code: "GN", name: "Guinea", flag: "🇬🇳" },
  { code: "GP", name: "Guadeloupe", flag: "🇬🇵" },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands", flag: "🇬🇸" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GU", name: "Guam", flag: "🇬🇺" },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "HM", name: "Heard Island and McDonald Islands", flag: "🇭🇲" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "HT", name: "Haiti", flag: "🇭🇹" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IM", name: "Isle of Man", flag: "🇮🇲" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "IO", name: "British Indian Ocean Territory", flag: "🇮🇴" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IR", name: "Iran, Islamic Republic of", flag: "🇮🇷" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JE", name: "Jersey", flag: "🇯🇪" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭" },
  { code: "KI", name: "Kiribati", flag: "🇰🇮" },
  { code: "KM", name: "Comoros", flag: "🇰🇲" },
  { code: "KN", name: "Saint Kitts and Nevis", flag: "🇰🇳" },
  { code: "KP", name: "Korea, Democratic People's Republic of", flag: "🇰🇵" },
  { code: "KR", name: "Korea, Republic of", flag: "🇰🇷" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "KY", name: "Cayman Islands", flag: "🇰🇾" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "LA", name: "Lao People's Democratic Republic", flag: "🇱🇦" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "LC", name: "Saint Lucia", flag: "🇱🇨" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "LR", name: "Liberia", flag: "🇱🇷" },
  { code: "LS", name: "Lesotho", flag: "🇱🇸" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LY", name: "Libya", flag: "🇱🇾" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "MC", name: "Monaco", flag: "🇲🇨" },
  { code: "MD", name: "Moldova, Republic of", flag: "🇲🇩" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MF", name: "Saint Martin (French part)", flag: "🇲🇫" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" },
  { code: "MH", name: "Marshall Islands", flag: "🇲🇭" },
  { code: "MK", name: "Macedonia, the former Yugoslav Republic of", flag: "🇲🇰" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "MO", name: "Macao", flag: "🇲🇴" },
  { code: "MP", name: "Northern Mariana Islands", flag: "🇲🇵" },
  { code: "MQ", name: "Martinique", flag: "🇲🇶" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷" },
  { code: "MS", name: "Montserrat", flag: "🇲🇸" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺" },
  { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "MW", name: "Malawi", flag: "🇲🇼" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NC", name: "New Caledonia", flag: "🇳🇨" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
  { code: "NF", name: "Norfolk Island", flag: "🇳🇫" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NR", name: "Nauru", flag: "🇳🇷" },
  { code: "NU", name: "Niue", flag: "🇳🇺" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PF", name: "French Polynesia", flag: "🇵🇫" },
  { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PM", name: "Saint Pierre and Miquelon", flag: "🇵🇲" },
  { code: "PN", name: "Pitcairn", flag: "🇵🇳" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "PS", name: "Palestine, State of", flag: "🇵🇸" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "PW", name: "Palau", flag: "🇵🇼" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "RE", name: "Reunion", flag: "🇷🇪" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "RU", name: "Russian Federation", flag: "🇷🇺" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SB", name: "Solomon Islands", flag: "🇸🇧" },
  { code: "SC", name: "Seychelles", flag: "🇸🇨" },
  { code: "SD", name: "Sudan", flag: "🇸🇩" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SH", name: "Saint Helena", flag: "🇸🇭" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "SJ", name: "Svalbard and Jan Mayen", flag: "🇸🇯" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱" },
  { code: "SM", name: "San Marino", flag: "🇸🇲" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "SO", name: "Somalia", flag: "🇸🇴" },
  { code: "SR", name: "Suriname", flag: "🇸🇷" },
  { code: "SS", name: "South Sudan", flag: "🇸🇸" },
  { code: "ST", name: "Sao Tome and Principe", flag: "🇸🇹" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "SX", name: "Sint Maarten (Dutch part)", flag: "🇸🇽" },
  { code: "SY", name: "Syrian Arab Republic", flag: "🇸🇾" },
  { code: "SZ", name: "Swaziland", flag: "🇸🇿" },
  { code: "TC", name: "Turks and Caicos Islands", flag: "🇹🇨" },
  { code: "TD", name: "Chad", flag: "🇹🇩" },
  { code: "TF", name: "French Southern Territories", flag: "🇹🇫" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯" },
  { code: "TK", name: "Tokelau", flag: "🇹🇰" },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TO", name: "Tonga", flag: "🇹🇴" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TV", name: "Tuvalu", flag: "🇹🇻" },
  { code: "TW", name: "Taiwan, Province of China", flag: "🇹🇼" },
  { code: "TZ", name: "Tanzania, United Republic of", flag: "🇹🇿" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UM", name: "United States Minor Outlying Islands", flag: "🇺🇲" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VA", name: "Holy See (Vatican City State)", flag: "🇻🇦" },
  { code: "VC", name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VG", name: "Virgin Islands, British", flag: "🇻🇬" },
  { code: "VI", name: "Virgin Islands, U.S.", flag: "🇻🇮" },
  { code: "VN", name: "Viet Nam", flag: "🇻🇳" },
  { code: "VU", name: "Vanuatu", flag: "🇻🇺" },
  { code: "WF", name: "Wallis and Futuna", flag: "🇼🇫" },
  { code: "WS", name: "Samoa", flag: "🇼🇸" },
  { code: "YE", name: "Yemen", flag: "🇾🇪" },
  { code: "YT", name: "Mayotte", flag: "🇾🇹" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" }
];

// Popular countries that should appear at the top
const popularCountries = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" }
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'default';
    const popular = searchParams.get('popular') === 'true';

    if (popular) {
      // Return only popular countries
      return NextResponse.json({
        success: true,
        countries: popularCountries,
        count: popularCountries.length
      });
    }

    if (format === 'grouped') {
      // Return with popular countries first, then others
      const otherCountries = countries.filter(
        country => !popularCountries.some(pop => pop.code === country.code)
      );

      return NextResponse.json({
        success: true,
        countries: {
          popular: popularCountries,
          others: otherCountries
        },
        total_count: countries.length
      });
    }

    // Return all countries sorted alphabetically
    const sortedCountries = [...countries].sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      countries: sortedCountries,
      count: sortedCountries.length
    });

  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch countries',
      details: error.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
