// Per-country enrichment: market metrics, local payment-method stacks,
// pro tips, pie-chart breakdown of e-commerce payment share, and rich
// provider rows. Slot-level fields are optional, when a country is
// missing a field, the slide gracefully degrades (renders an em-dash or
// skips the row).
//
// Sourced from the Yuno Global Market Insights 2026 deck set. MENAT
// values match the source slide screenshots verbatim. Other regions have
// the headline numbers extracted from `Research Content by Country.md`
// (digital trends bullets) plus reasonable defaults for the local-PM
// stack until the regional team confirms.

export const COUNTRY_METRICS = {
  // MENAT, sourced directly from the source-deck callout cards
  'Turkey':                { population: '86.04M', sp: '87%',  i: '99%',   marketValue: '$39.68B', cagr: '10.6%' },
  'Jordan':                { population: '11.6M',  sp: '92%',  i: '97%',   marketValue: '$3.73B',  cagr: '6.5%'  },
  'Kuwait':                { population: '4.33M',  sp: '92%',  i: '99%',   marketValue: '$1.68B',  cagr: '14.1%' },
  'Bahrain':               { population: '1.6M',   sp: '92%',  i: '99%',   marketValue: '$1.28B',  cagr: '10.4%' },
  'Saudi Arabia':          { population: '35.3M',  sp: '92%',  i: '99.4%', marketValue: '$20.78B', cagr: '12.1%' },
  'Qatar':                 { population: '3M',     sp: '95%',  i: '99%',   marketValue: '$3.8B',   cagr: '10.27%'},
  'United Arab Emirates':  { population: '11.3M',  sp: '95%',  i: '99%',   marketValue: '$32.38B', cagr: '9.4%'  },
  'Oman':                  { population: '5.3M',   sp: '85%',  i: '97.8%', marketValue: '$2.2B',   cagr: '13.5%' },
  'Egypt':                 { population: '111M',   sp: '70%',  i: '72%',   marketValue: '$10B',    cagr: '12%'   },
  'Morocco':               { population: '37.8M',  sp: '78%',  i: '88%',   marketValue: '$3.5B',   cagr: '11%'   },
  'Iraq':                  { population: '45M',    sp: '88%',  i: '79%',   marketValue: '$15B',    cagr: '8%'    },

  // Americas / LATAM
  'United States':         { population: '335M',   sp: '92%',  i: '97%',   marketValue: '$1.2T',   cagr: '10.5%' },
  'Canada':                { population: '40M',    sp: '90%',  i: '97%',   marketValue: 'CAD$77B', cagr: '11%'   },
  'Mexico':                { population: '129M',   sp: '78%',  i: '83.2%', marketValue: '$97B',    cagr: '24%'   },
  'Brazil':                { population: '215M',   sp: '97%',  i: '86.6%', marketValue: '$346B',   cagr: '19%'   },
  'Colombia':              { population: '52M',    sp: '85%',  i: '83.2%', marketValue: '$52B',    cagr: '16%'   },
  'Chile':                 { population: '19.6M',  sp: '92%',  i: '95%',   marketValue: '$13B',    cagr: '12%'   },
  'Argentina':             { population: '46M',    sp: '88%',  i: '87%',   marketValue: '$18B',    cagr: '15%'   },
  'Peru':                  { population: '34M',    sp: '75%',  i: '76%',   marketValue: '$10B',    cagr: '17%'   },

  // Europe
  'United Kingdom':        { population: '68M',    sp: '94%',  i: '98%',   marketValue: '£200B',   cagr: '8%'    },
  'Germany':               { population: '83M',    sp: '92%',  i: '96%',   marketValue: '€90B',    cagr: '6.5%'  },
  'France':                { population: '68M',    sp: '93%',  i: '93%',   marketValue: '€160B',   cagr: '9%'    },
  'Spain':                 { population: '48M',    sp: '92%',  i: '94%',   marketValue: '€50B',    cagr: '10%'   },
  'Netherlands':           { population: '17.7M',  sp: '95%',  i: '99%',   marketValue: '€35B',    cagr: '7%'    },
  'Italy':                 { population: '59M',    sp: '88%',  i: '85%',   marketValue: '€55B',    cagr: '8%'    },
  'Poland':                { population: '38M',    sp: '85%',  i: '88%',   marketValue: '€30B',    cagr: '9.5%'  },
  'Sweden':                { population: '10.5M',  sp: '95%',  i: '98%',   marketValue: '€20B',    cagr: '7%'    },

  // APAC
  'Japan':                 { population: '124M',   sp: '90%',  i: '93%',   marketValue: '$200B',   cagr: '7%'    },
  'South Korea':           { population: '52M',    sp: '95%',  i: '97%',   marketValue: '$130B',   cagr: '6%'    },
  'India':                 { population: '1.43B',  sp: '76%',  i: '52%',   marketValue: '$110B',   cagr: '21%'   },
  'Indonesia':             { population: '278M',   sp: '74%',  i: '79%',   marketValue: '$68B',    cagr: '16%'   },
  'Singapore':             { population: '5.9M',   sp: '92%',  i: '96%',   marketValue: '$9.5B',   cagr: '11%'   },
  'Australia':             { population: '26M',    sp: '92%',  i: '95%',   marketValue: 'AUD$70B', cagr: '8%'    },
  'Philippines':           { population: '117M',   sp: '70%',  i: '73%',   marketValue: '$25B',    cagr: '15%'   },
  'Thailand':              { population: '70M',    sp: '85%',  i: '88%',   marketValue: '$30B',    cagr: '12%'   },
}

// Local payment scheme + A2A rails + most relevant APMs per country.
// Strings, or `null` when none exists for that lane. Matches the source
// deck's "Yuno handles all major international payment methods" layout.
export const COUNTRY_LOCAL_PMS = {
  // MENAT, verbatim from the source slide
  'Turkey':               { localScheme: 'TROY',      localA2A: 'FAST',  apms: ['Dynamic QR'] },
  'Jordan':               { localScheme: null,        localA2A: 'CLIQ',  apms: ['Zain Cash', 'Orange Money'] },
  'Kuwait':               { localScheme: 'KNET',      localA2A: 'WAMD',  apms: ['Tamara', 'Tabby'] },
  'Bahrain':              { localScheme: 'BENEFIT',   localA2A: 'FAWRI+', apms: ['FLOOS'] },
  'Saudi Arabia':         { localScheme: 'MADA',      localA2A: 'SARIE', apms: ['Tamara', 'Tabby'] },
  'Qatar':                { localScheme: 'NAPS',      localA2A: 'FAWRAN', apms: ['QMP'] },
  'United Arab Emirates': { localScheme: 'JAYWAN',    localA2A: 'AANI',  apms: ['Tamara', 'Tabby'] },
  'Oman':                 { localScheme: 'OMANNET',   localA2A: 'IPS',   apms: ['Tamara', 'Tabby'] },
  'Egypt':                { localScheme: 'Meeza',     localA2A: 'InstaPay', apms: ['Vodafone Cash', 'Fawry'] },
  'Morocco':              { localScheme: 'CMI',       localA2A: null,    apms: ['Mobile wallets'] },
  'Iraq':                 { localScheme: null,        localA2A: null,    apms: [] },

  // Americas / LATAM
  'United States':        { localScheme: null,        localA2A: 'ACH',   apms: ['PayPal', 'Apple Pay', 'Google Pay'] },
  'Canada':               { localScheme: 'Interac',   localA2A: 'Interac e-Transfer', apms: ['PayPal', 'Apple Pay'] },
  'Mexico':               { localScheme: 'Carnet',    localA2A: 'SPEI',  apms: ['OXXO Pay', 'CoDi'] },
  'Brazil':               { localScheme: 'Elo',       localA2A: 'Pix',   apms: ['Boleto', 'Mercado Pago'] },
  'Colombia':             { localScheme: null,        localA2A: 'PSE',   apms: ['Nequi', 'Daviplata', 'Efecty'] },
  'Chile':                { localScheme: 'Redcompra', localA2A: 'A2A',   apms: ['Khipu', 'WebPay'] },
  'Argentina':            { localScheme: null,        localA2A: 'A2A',   apms: ['Mercado Pago', 'Pago Fácil'] },
  'Peru':                 { localScheme: null,        localA2A: null,    apms: ['Yape', 'PagoEfectivo'] },

  // Europe
  'United Kingdom':       { localScheme: null,        localA2A: 'Faster Payments', apms: ['Klarna', 'PayPal', 'Open Banking'] },
  'Germany':              { localScheme: 'girocard',  localA2A: 'SEPA',  apms: ['Klarna', 'Sofort', 'giropay', 'PayPal'] },
  'France':               { localScheme: 'CB',        localA2A: 'SEPA',  apms: ['Klarna', 'PayPal'] },
  'Spain':                { localScheme: null,        localA2A: 'Bizum', apms: ['Klarna', 'PayPal'] },
  'Netherlands':          { localScheme: null,        localA2A: 'iDEAL', apms: ['Klarna'] },
  'Italy':                { localScheme: 'BANCOMAT',  localA2A: 'SEPA',  apms: ['Satispay', 'PostePay', 'Klarna'] },
  'Poland':               { localScheme: null,        localA2A: 'BLIK',  apms: ['Przelewy24', 'Klarna'] },
  'Sweden':               { localScheme: null,        localA2A: 'Swish', apms: ['Klarna', 'Trustly'] },

  // APAC
  'Japan':                { localScheme: 'JCB',       localA2A: 'Zengin', apms: ['PayPay', 'LINE Pay', 'Konbini'] },
  'South Korea':          { localScheme: 'BC Card',   localA2A: 'A2A',   apms: ['KakaoPay', 'Naver Pay', 'Samsung Pay'] },
  'India':                { localScheme: 'RuPay',     localA2A: 'UPI',   apms: ['Paytm', 'PhonePe'] },
  'Indonesia':            { localScheme: null,        localA2A: 'QRIS',  apms: ['GoPay', 'OVO', 'Dana', 'ShopeePay'] },
  'Singapore':            { localScheme: 'NETS',      localA2A: 'PayNow', apms: ['GrabPay'] },
  'Australia':            { localScheme: 'eftpos',    localA2A: 'PayTo', apms: ['Afterpay', 'Zip', 'PayPal'] },
  'Philippines':          { localScheme: null,        localA2A: 'InstaPay', apms: ['GCash', 'GrabPay'] },
  'Thailand':             { localScheme: null,        localA2A: 'PromptPay', apms: ['TrueMoney', 'Rabbit LINE Pay'] },
}

// Pie-chart breakdown of e-commerce payment share. Percentages add to
// ~100 and are rendered in the source-deck colour order (blue / dark /
// pale / mid / grey / soft). Only the countries with a clean numeric
// split are seeded, others fall back to the digital-wallet vs cards
// vs other split derived at render time.
export const COUNTRY_PIE = {
  // MENAT
  'Saudi Arabia': [
    { label: 'Digital Wallets', pct: 33 }, { label: 'Debit Cards', pct: 29 }, { label: 'A2A', pct: 16 },
    { label: 'Credit Cards', pct: 12 }, { label: 'Cash', pct: 7 }, { label: 'BNPL', pct: 3 },
  ],
  'United Arab Emirates': [
    { label: 'Credit/Debit Cards', pct: 50 }, { label: 'Apple/Google Pay', pct: 22 },
    { label: 'Digital Wallets', pct: 15 }, { label: 'Cash on Delivery', pct: 10 }, { label: 'Bank Transfers', pct: 3 },
  ],
  'Turkey': [
    { label: 'Credit Cards (taksit)', pct: 70 }, { label: 'BKM Express', pct: 10 },
    { label: 'Digital Wallets', pct: 8 }, { label: 'Cash on Delivery', pct: 6 }, { label: 'Bank Transfers', pct: 6 },
  ],
  'Qatar': [
    { label: 'Credit/Debit Cards', pct: 60 }, { label: 'Apple/Google Pay', pct: 18 },
    { label: 'Digital Wallets', pct: 10 }, { label: 'Cash on Delivery', pct: 8 }, { label: 'Bank Transfers', pct: 4 },
  ],
  'Kuwait': [
    { label: 'KNET Debit', pct: 70 }, { label: 'Credit Cards', pct: 18 },
    { label: 'Apple/Google Pay', pct: 8 }, { label: 'Cash on Delivery', pct: 3 }, { label: 'Bank Transfers', pct: 1 },
  ],
  'Bahrain': [
    { label: 'BenefitPay', pct: 47 }, { label: 'Credit/Debit Cards', pct: 35 },
    { label: 'Apple/Google Pay', pct: 10 }, { label: 'Cash on Delivery', pct: 6 }, { label: 'Other', pct: 2 },
  ],
  'Oman': [
    { label: 'Credit/Debit Cards', pct: 45 }, { label: 'Cash on Delivery', pct: 30 },
    { label: 'Mobile Wallets', pct: 15 }, { label: 'Bank Transfers', pct: 7 }, { label: 'Other', pct: 3 },
  ],
  'Jordan': [
    { label: 'Cash on Delivery', pct: 55 }, { label: 'Credit/Debit Cards', pct: 25 },
    { label: 'Mobile Wallets', pct: 12 }, { label: 'Bank Transfers', pct: 6 }, { label: 'Other', pct: 2 },
  ],
  'Egypt': [
    { label: 'Cash on Delivery', pct: 50 }, { label: 'Cards (incl. Meeza)', pct: 25 },
    { label: 'Mobile Wallets', pct: 15 }, { label: 'Bank Transfers', pct: 7 }, { label: 'Fawry Voucher', pct: 3 },
  ],
  'Morocco': [
    { label: 'Cash on Delivery', pct: 70 }, { label: 'Cards (CMI)', pct: 22 },
    { label: 'Mobile Wallets', pct: 6 }, { label: 'Bank Transfers', pct: 2 },
  ],
  'Iraq': [
    { label: 'Cash on Delivery', pct: 80 }, { label: 'Cards', pct: 12 },
    { label: 'Mobile Wallets', pct: 6 }, { label: 'Other', pct: 2 },
  ],

  // Americas / LATAM
  'United States': [
    { label: 'Digital Wallets', pct: 32 }, { label: 'Credit/Debit Cards', pct: 30 },
    { label: 'BNPL', pct: 9 }, { label: 'Bank Transfers / ACH', pct: 3 },
    { label: 'Prepaid/Gift Cards', pct: 3 }, { label: 'Other', pct: 23 },
  ],
  'Canada': [
    { label: 'Credit Cards', pct: 40 }, { label: 'Digital Wallets', pct: 22 },
    { label: 'Debit / Interac', pct: 15 }, { label: 'BNPL', pct: 7 },
    { label: 'Bank Transfers', pct: 5 }, { label: 'Other', pct: 11 },
  ],
  'Mexico': [
    { label: 'Credit/Debit Cards', pct: 48 }, { label: 'SPEI', pct: 21 },
    { label: 'Digital Wallets', pct: 13 }, { label: 'OXXO Pay', pct: 15 }, { label: 'COD', pct: 3 },
  ],
  'Brazil': [
    { label: 'Pix', pct: 42 }, { label: 'Credit Cards', pct: 41 },
    { label: 'Boleto', pct: 8 }, { label: 'Digital Wallets', pct: 9 },
  ],
  'Colombia': [
    { label: 'PSE', pct: 35 }, { label: 'Credit Cards', pct: 37 },
    { label: 'Nequi/Daviplata', pct: 18 }, { label: 'Cash/Efecty', pct: 7 }, { label: 'Other', pct: 3 },
  ],
  'Chile': [
    { label: 'Credit/Debit Cards', pct: 65 }, { label: 'A2A (Webpay/Khipu)', pct: 18 },
    { label: 'Digital Wallets', pct: 10 }, { label: 'BNPL', pct: 4 }, { label: 'Other', pct: 3 },
  ],
  'Argentina': [
    { label: 'Credit/Debit Cards', pct: 55 }, { label: 'Mercado Pago Wallet', pct: 28 },
    { label: 'Cash (Pago Fácil/Rapipago)', pct: 10 }, { label: 'Bank Transfers', pct: 5 }, { label: 'Other', pct: 2 },
  ],
  'Peru': [
    { label: 'Credit/Debit Cards', pct: 45 }, { label: 'Yape/Plin Wallets', pct: 28 },
    { label: 'Cash (PagoEfectivo)', pct: 15 }, { label: 'Bank Transfers', pct: 8 }, { label: 'BNPL', pct: 4 },
  ],

  // Europe
  'United Kingdom': [
    { label: 'Credit/Debit Cards', pct: 50 }, { label: 'Digital Wallets', pct: 20 },
    { label: 'PayPal', pct: 12 }, { label: 'BNPL (Klarna)', pct: 8 },
    { label: 'Open Banking', pct: 5 }, { label: 'Other', pct: 5 },
  ],
  'Germany': [
    { label: 'PayPal', pct: 28 }, { label: 'Invoice / Kauf auf Rechnung', pct: 20 },
    { label: 'Credit/Debit Cards', pct: 15 }, { label: 'SEPA / Sofort', pct: 18 },
    { label: 'BNPL (Klarna)', pct: 12 }, { label: 'Other', pct: 7 },
  ],
  'France': [
    { label: 'Cards (Carte Bancaire)', pct: 55 }, { label: 'Digital Wallets', pct: 18 },
    { label: 'PayPal', pct: 12 }, { label: 'SEPA', pct: 8 }, { label: 'BNPL', pct: 7 },
  ],
  'Spain': [
    { label: 'Credit/Debit Cards', pct: 50 }, { label: 'Bizum', pct: 18 },
    { label: 'PayPal', pct: 15 }, { label: 'SEPA', pct: 8 }, { label: 'BNPL', pct: 6 }, { label: 'Other', pct: 3 },
  ],
  'Netherlands': [
    { label: 'iDEAL', pct: 62 }, { label: 'Credit/Debit Cards', pct: 15 },
    { label: 'PayPal', pct: 10 }, { label: 'BNPL (Klarna)', pct: 8 }, { label: 'SEPA', pct: 5 },
  ],
  'Italy': [
    { label: 'Credit/Debit Cards', pct: 45 }, { label: 'PayPal', pct: 22 },
    { label: 'Digital Wallets', pct: 14 }, { label: 'Satispay/PostePay', pct: 10 },
    { label: 'SEPA', pct: 5 }, { label: 'BNPL', pct: 4 },
  ],
  'Poland': [
    { label: 'BLIK', pct: 36 }, { label: 'Credit/Debit Cards', pct: 30 },
    { label: 'Przelewy24', pct: 18 }, { label: 'BNPL (Klarna)', pct: 8 },
    { label: 'PayPal', pct: 5 }, { label: 'SEPA', pct: 3 },
  ],
  'Sweden': [
    { label: 'BNPL (Klarna)', pct: 32 }, { label: 'Credit/Debit Cards', pct: 28 },
    { label: 'Swish', pct: 18 }, { label: 'Trustly', pct: 12 },
    { label: 'PayPal', pct: 6 }, { label: 'SEPA', pct: 4 },
  ],

  // APAC
  'Japan': [
    { label: 'Credit Cards', pct: 60 }, { label: 'Konbini', pct: 10 },
    { label: 'PayPay', pct: 9 }, { label: 'LINE Pay', pct: 6 },
    { label: 'Bank Transfer', pct: 9 }, { label: 'Other', pct: 6 },
  ],
  'South Korea': [
    { label: 'Credit Cards', pct: 55 }, { label: 'KakaoPay', pct: 18 },
    { label: 'Naver Pay', pct: 12 }, { label: 'Samsung Pay', pct: 8 }, { label: 'Other', pct: 7 },
  ],
  'India': [
    { label: 'UPI', pct: 50 }, { label: 'Credit/Debit Cards', pct: 22 },
    { label: 'Wallets (Paytm/PhonePe)', pct: 18 }, { label: 'Net Banking', pct: 7 }, { label: 'COD', pct: 3 },
  ],
  'Indonesia': [
    { label: 'E-Wallets (GoPay/OVO/Dana)', pct: 38 }, { label: 'Bank Transfer (VA)', pct: 28 },
    { label: 'Credit/Debit Cards', pct: 12 }, { label: 'Convenience Store', pct: 8 },
    { label: 'COD', pct: 9 }, { label: 'QRIS', pct: 5 },
  ],
  'Singapore': [
    { label: 'Credit/Debit Cards', pct: 48 }, { label: 'PayNow', pct: 14 },
    { label: 'GrabPay', pct: 10 }, { label: 'Apple/Google Pay', pct: 8 },
    { label: 'BNPL', pct: 6 }, { label: 'Bank Transfer', pct: 14 },
  ],
  'Australia': [
    { label: 'Credit/Debit Cards', pct: 52 }, { label: 'PayPal', pct: 16 },
    { label: 'Apple/Google Pay', pct: 9 }, { label: 'BNPL (Afterpay/Zip)', pct: 11 },
    { label: 'Bank Transfer', pct: 5 }, { label: 'POLi', pct: 7 },
  ],
  'Philippines': [
    { label: 'GCash', pct: 40 }, { label: 'Credit/Debit Cards', pct: 18 },
    { label: 'GrabPay/Maya', pct: 15 }, { label: 'Bank Transfer', pct: 12 },
    { label: 'COD', pct: 12 }, { label: 'Other', pct: 3 },
  ],
  'Thailand': [
    { label: 'PromptPay', pct: 38 }, { label: 'Credit/Debit Cards', pct: 25 },
    { label: 'TrueMoney/Rabbit LINE Pay', pct: 18 }, { label: 'COD', pct: 12 }, { label: 'Other', pct: 7 },
  ],
}

// Per-country pro-tip bullets, short, 2–6 words, paired with an icon
// in the slide. Used by the SlideCountryMarket "Pro tip" panel. Skipped
// when the country has no curated tips.
export const COUNTRY_PRO_TIPS = {
  // MENAT
  'Saudi Arabia': [
    'Highly regulated, requires local entity',
    'Enable wallets & measure impact by device, issuer & basket size',
    'Enable both MADA products (debit scheme + A2A SARIE)',
    'Treat A2A as a performance + cost lever',
  ],
  'United Arab Emirates': [
    'Cross-border hub, enable multi-currency',
    'Apple Pay + Google Pay are table-stakes for premium merchants',
    'BNPL (Tamara / Tabby) drives uplift on fashion + electronics',
    'JAYWAN national scheme rolling out, plan acceptance',
  ],
  'Turkey': [
    'Installments ("taksit") are non-negotiable',
    'Local scheme TROY + Apple Pay growing fast',
    'FAST instant rails up 15% YoY',
    'Currency volatility, price-protect with multi-currency settlement',
  ],
  'Qatar': [
    'Premium ARPU market, optimise for card acceptance',
    'Apple Pay + Google Pay drive premium-brand uplift',
    'QMP local APM gaining traction in food delivery',
    'FAWRAN instant rail launched 2024, plan A2A',
  ],
  'Kuwait': [
    'KNET dominates checkout, must be enabled day 1',
    'WAMD instant rail growing fast for marketplaces',
    'BNPL (Tamara / Tabby) sharply rising in fashion + electronics',
    'High-ARPU but small population, channel matters more than scale',
  ],
  'Bahrain': [
    'BenefitPay holds ~47% of e-commerce, table-stakes',
    'Open banking framework in force since 2020',
    'Small market, best as a GCC expansion play, not standalone',
    'FAWRI+ instant rail viable for B2C marketplaces',
  ],
  'Oman': [
    'Card-heavy but COD still ~30%, keep both lanes',
    'OmanNet scheme acceptance required for local issuers',
    'BNPL appetite rising in fashion + electronics',
    'Best paired with KSA / UAE merchant expansion',
  ],
  'Jordan': [
    'No national card scheme, CLIQ instant rail fills the gap',
    'Zain Cash + Orange Money lead mobile money',
    'Cross-border PSPs preferred over local rails for global merchants',
    'Tier-2 market, anchor on KSA / UAE merchants expanding in',
  ],
  'Egypt': [
    'Cash on Delivery still ~50%, bridge with mobile wallets',
    'Meeza national scheme + InstaPay rails growing fast',
    'High-volume but low-ARPU, design for instalments + COD funnel',
    'Mobile wallet adoption up 56% YoY',
  ],
  'Morocco': [
    'Cash on Delivery ~70%, local fulfilment matters more than PSP routing',
    'CMI controls all local card acquiring, single integration point',
    'Six active mobile wallet ecosystems, pick the top 2 by vertical',
    'Bank Al-Maghrib pushing instant payment rails, plan A2A',
  ],
  'Iraq': [
    'Cash on Delivery dominant, payment is the last mile, not checkout',
    'NEC Payment Services is the de-facto local rail',
    'Volatile market, verify routing with regional team before pitch',
    'Best entered after stabilising KSA / UAE base',
  ],

  // Americas / LATAM
  'United States': [
    'Card-not-present fraud is the #1 cost lever, invest in 3DS + risk routing',
    'Apple Pay + Google Pay drive lift on mobile checkout',
    'BNPL (Affirm / Klarna / Afterpay) growing fast in fashion + electronics',
    'State-level privacy laws (CCPA model) expanding, review subscription billing',
  ],
  'Canada': [
    'Interac essential, ~15% of e-commerce starts with the debit network',
    '60% of Canadians buy from US merchants, enable cross-border seamlessly',
    'Bill C-27 reshaping privacy expectations, review consent UX',
    'PayPal still a top-3 method, keep it live',
  ],
  'Mexico': [
    'OXXO Pay is the unbanked bridge, 50% of voucher-based digital txns',
    'SPEI instant rail (5.34B txns in 2024), must-have for marketplaces',
    'Ley Fintech enables wallet innovation, Spin / Mercado Pago rising',
    'Mobile drives 78.5% of purchases, optimise mobile checkout first',
  ],
  'Brazil': [
    'Pix is non-negotiable, 42% of e-commerce, projected 51% by 2027',
    'Installments ("parcelado") culturally embedded for card payments',
    'Boleto still relevant for unbanked + cross-border merchants',
    'Mobile commerce drives 54% of transaction value',
  ],
  'Colombia': [
    'PSE dominates bank-transfer flow, single integration unlocks 35%+ share',
    'Nequi + Daviplata are mass-market wallets, 76% combined adoption',
    'Cash (Efecty) still relevant for underbanked, keep as fallback',
    'Local card acquirer (PayU / Wompi) gives best decline rates',
  ],
  'Chile': [
    'Cards dominate, Webpay is the de-facto checkout for ~65% of merchants',
    'A2A via Fintoc growing fast as Webpay alternative',
    'BNPL (Mach / CMR Falabella) rising in fashion + electronics',
    'Highly digital, mobile-first checkout is table-stakes',
  ],
  'Argentina': [
    'Currency volatility, settle in USD via cross-border PSP',
    'Mercado Pago wallet is the de-facto APM, 28% of e-commerce',
    'Card installments mandatory ("cuotas sin interés")',
    'Pago Fácil / Rapipago cover the unbanked cash funnel',
  ],
  'Peru': [
    'Yape + Plin wallets dominate, 28% combined share',
    'BNPL via Powerpay rising in fashion + electronics',
    'PagoEfectivo covers cash funnel for unbanked',
    'Card decline rates high, local acquirer routing matters',
  ],

  // Europe
  'United Kingdom': [
    'Open Banking growing, A2A PISP rails viable for B2C marketplaces',
    'Klarna + Clearpay drive uplift on fashion + electronics',
    'Apple Pay + Google Pay table-stakes on mobile',
    'PSD2 SCA mandatory, invest in frictionless 3DS routing',
  ],
  'Germany': [
    'Invoice payment ("Kauf auf Rechnung") is ~20% of e-commerce',
    'PayPal dominant (~28%), must be enabled',
    'SEPA / Sofort still critical for marketplaces',
    'Klarna native, pay-later expected, not novel',
  ],
  'France': [
    'Carte Bancaire local scheme, must accept for ~55% domestic coverage',
    'Multi-step 3DS friction is high, invest in exemption routing',
    'BNPL (Klarna / Oney / Younited) accelerating',
    'SEPA Direct Debit useful for subscription verticals',
  ],
  'Spain': [
    'Bizum is the rising A2A wallet, 18% and growing',
    'Cards still dominate but BNPL (Klarna / SeQura) rising',
    'PSD2 SCA mandatory, protect approval rates with exemptions',
    'Mobile commerce driving most growth, optimise checkout flow',
  ],
  'Netherlands': [
    'iDEAL is the market, 62% of e-commerce, single integration unlocks it',
    'Klarna BNPL growing on top of iDEAL for fashion + electronics',
    'PayPal still relevant but secondary',
    'Most digitally-mature market in Europe, UX bar is high',
  ],
  'Italy': [
    'PayPal dominant (~22%), must be enabled',
    'Satispay + PostePay growing fast, APM stack matters',
    'Cards heavy on installments, 12+ month plans common',
    'Cash-on-Delivery still relevant in mass-market e-commerce',
  ],
  'Poland': [
    'BLIK dominates, ~36% of e-commerce, must be enabled',
    'Przelewy24 covers card + bank-transfer routing',
    'BNPL (Klarna / PayPo) rising in fashion + electronics',
    'Cards growing but BLIK is the leader, design checkout around it',
  ],
  'Sweden': [
    'Klarna native, pay-later expected, default to it',
    'Swish for mobile P2P + e-commerce, ~18% adoption',
    'Trustly for A2A, clean A2A rail with high conversion',
    'Nearly cashless, invest in mobile-first checkout',
  ],

  // APAC
  'Japan': [
    'Credit cards dominate (~60%) but Konbini still ~10% for unbanked',
    'PayPay growing fast (~9%), wallet adoption rising',
    'Cards heavy on installments + revolving credit',
    'Strict KYC + AML, local acquirer matters for approval rates',
  ],
  'South Korea': [
    'Cards dominate, KakaoPay + Naver Pay layered on top',
    'Samsung Pay strong on Android (90%+ market share)',
    'Local acquirer routing critical, global PSPs struggle alone',
    'Highly digital, UX expectations are world-class',
  ],
  'India': [
    'UPI is the market, 50% of e-commerce, single integration unlocks it',
    'RuPay national card scheme growing fast, must accept',
    'BNPL + EMI table-stakes on electronics + fashion',
    'Local entity + RBI compliance required for licensing',
  ],
  'Indonesia': [
    'E-wallets (GoPay / OVO / Dana / ShopeePay) dominate, multi-wallet routing',
    'Bank transfer via VA still ~28%, critical for marketplaces',
    'QRIS national QR rail growing fast, plan acceptance',
    'COD still ~9%, keep as last-mile bridge',
  ],
  'Singapore': [
    'APAC HQ for cross-border merchants, enable multi-currency',
    'PayNow growing, A2A rails increasingly viable',
    'GrabPay strong in food delivery + ride-hailing flows',
    'Most digitally-mature SEA market, UX bar is high',
  ],
  'Australia': [
    'BNPL (Afterpay / Zip) is ~11%, table-stakes for fashion + electronics',
    'PayPal still a top-2 method, keep it live',
    'PayTo on NPP rails growing for subscription verticals',
    'POLi acceptance optional but useful for niche verticals',
  ],
  'Philippines': [
    'GCash dominates (~40%), must be enabled day 1',
    'InstaPay A2A rail growing for marketplaces',
    'COD still ~12%, keep as funnel-completion option',
    'Maya growing as #2 wallet, multi-wallet routing matters',
  ],
  'Thailand': [
    'PromptPay dominates A2A, ~38% of e-commerce',
    'TrueMoney + Rabbit LINE Pay growing wallet stack',
    '2C2P local routing essential for approval rates',
    'COD still ~12%, keep as funnel-completion option',
  ],
}

// Rich provider rows per country for the connections table. Each entry:
//   { name, type, description, relevance, logo? }
// `logo` is a path under /logos/providers/ if we have a white-on-dark
// silhouette asset. Otherwise the slide renders the provider name as a
// styled wordmark.
export const COUNTRY_PROVIDERS = {
  'Saudi Arabia': [
    { name: 'HyperPay',  type: 'Aggregator + Gateway', description: 'Riyadh-headquartered, regional gateway built for MENA enterprises', relevance: 'Largest local gateway by merchant coverage' },
    { name: 'Paymob',    type: 'Aggregator + Gateway', description: 'Egypt-founded, SAMA PTSP-certified (2023)', relevance: '200K merchants across MENA, well-positioned in KSA' },
    { name: 'Moyasar',   type: 'Aggregator + Gateway', description: 'Fastest-growing local gateway, Saudi-built, SAMA-licensed', relevance: 'Preferred by startups and digital-native merchants' },
    { name: 'Telr',      type: 'Aggregator + Gateway', description: 'Mid-market PSP widely used across GCC', relevance: 'UAE-origin but strong KSA presence' },
    { name: 'Tap',       type: 'Aggregator + Gateway', description: 'Kuwait/UAE-based payment platform serving the GCC', relevance: 'Growing regional player within Arab markets' },
  ],
  'United Arab Emirates': [
    { name: 'Checkout.com', type: 'Aggregator + Gateway', description: 'Global payment platform with high-performance local acquiring', relevance: 'Top choice for international enterprise brands operating in UAE' },
    { name: 'Telr',         type: 'Aggregator + Gateway', description: 'Regional GCC PSP with strong UAE presence', relevance: '350K merchants across MENA, strong SME penetration' },
    { name: 'Tap',          type: 'Aggregator + Gateway', description: 'Kuwait/UAE-based payment platform serving the GCC', relevance: 'Processes 1bn txn annually across MENA' },
    { name: 'PayTabs',      type: 'Aggregator + Gateway', description: 'Riyadh-headquartered, regional gateway built for MENA enterprises', relevance: 'PSP with strong SME focus' },
    { name: 'HyperPay',     type: 'Aggregator + Gateway', description: 'PSP Egypt-founded, expanding across the region', relevance: 'Help merchants expanding from KSA to UAE' },
    { name: 'Paymob',       type: 'Aggregator + Gateway', description: 'Mid-market PSP widely used across GCC', relevance: 'UAE-origin but strong KSA presence' },
  ],
  'Turkey': [
    { name: 'iyzico',      type: 'Aggregator + Gateway', description: 'End-to-end Turkish payment platform for online merchants', relevance: 'Largest e-commerce PSP in Turkey' },
    { name: 'PayTR',       type: 'Aggregator + Gateway', description: 'Local Turkish virtual POS and online payment infrastructure', relevance: 'Dominant among local SME e-commerce' },
    { name: 'Param',       type: 'Aggregator + Gateway', description: 'Full-stack fintech with wallet, POS, card issuing, and gateway', relevance: 'First BDDK-licensed e-money institution in Turkey' },
    { name: 'BKM Express', type: 'Aggregator + Gateway', description: 'Turkish PSP specialising in virtual POS, cross-border, B2B and marketplace payments', relevance: '$4B+ TPV in 2024, growing in the Turkish market' },
    { name: 'Sipay',       type: 'Aggregator + Gateway', description: 'Turkish PSP founded in 2012 focused on e-commerce and mobile digital payments', relevance: 'Specialist in gaming vertical' },
  ],

  // MENAT, remaining T2 / T3 markets
  'Qatar': [
    { name: 'Tap',     type: 'Aggregator + Gateway', description: 'Kuwait/UAE-based PSP serving the GCC', relevance: 'Strong GCC merchant coverage' },
    { name: 'PayTabs', type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'Solid SME footprint in Qatar' },
    { name: 'QNB',     type: 'Acquirer + Gateway',   description: 'Qatar National Bank merchant acquiring arm', relevance: 'Top local acquirer by market share' },
  ],
  'Kuwait': [
    { name: 'Tap',         type: 'Aggregator + Gateway', description: 'Kuwait-founded PSP serving the GCC', relevance: 'Largest local PSP, deep KNET integration' },
    { name: 'MyFatoorah',  type: 'Aggregator + Gateway', description: 'Kuwaiti PSP with mass-market merchant base', relevance: 'Strong SME penetration; KNET-native' },
    { name: 'PayTabs',     type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'GCC expansion play; mid-market PSP' },
  ],
  'Bahrain': [
    { name: 'BenefitPay', type: 'Local Wallet + A2A', description: 'National wallet operated by Bahrain Credit Reference Bureau', relevance: '~47% of Bahraini e-commerce; table-stakes' },
    { name: 'Tap',        type: 'Aggregator + Gateway', description: 'GCC-wide PSP, deep Bahrain coverage', relevance: 'Top international PSP locally' },
    { name: 'PayTabs',    type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'Mid-market SME PSP in Bahrain' },
  ],
  'Oman': [
    { name: 'Tap',                  type: 'Aggregator + Gateway', description: 'GCC PSP with strong Oman SME presence', relevance: 'Default checkout for many Omani e-commerce sites' },
    { name: 'PayTabs',              type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'Mid-market PSP in Oman' },
    { name: 'Network International', type: 'Acquirer + Gateway',  description: 'UAE-headquartered processor covering 50+ MEA markets', relevance: 'Top regional acquirer in Oman' },
  ],
  'Jordan': [
    { name: 'HyperPay', type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'Strong Levant coverage' },
    { name: 'Tap',      type: 'Aggregator + Gateway', description: 'GCC PSP with growing Jordan presence', relevance: 'Cross-border merchants entering Jordan default to Tap' },
    { name: 'PayTabs',  type: 'Aggregator + Gateway', description: 'Riyadh-headquartered regional gateway', relevance: 'Mid-market PSP, SME-friendly' },
  ],
  'Egypt': [
    { name: 'Paymob',                type: 'Aggregator + Gateway', description: 'Egypt-founded, dominant local PSP across MENA', relevance: '#1 PSP in Egypt by merchant count' },
    { name: 'Fawry',                 type: 'Cash voucher + Wallet', description: 'Cash collection + wallet network with 250K+ agents', relevance: 'Mass-market funnel for unbanked' },
    { name: 'Network International', type: 'Acquirer + Gateway',  description: 'UAE-headquartered processor covering 50+ MEA markets', relevance: 'Top regional acquirer in Egypt' },
  ],
  'Morocco': [
    { name: 'CMI',  type: 'National Acquirer',     description: 'Centre Monétique Interbancaire, runs all local card acquiring', relevance: 'Mandatory for accepting Moroccan cards' },
    { name: 'Naps', type: 'Aggregator + Gateway', description: 'Local Moroccan PSP focused on SMEs and marketplaces', relevance: 'Emerging local PSP, growing SME base' },
  ],
  'Iraq': [
    { name: 'NEC Payment Services', type: 'Acquirer + Gateway', description: 'Local Iraqi acquirer + payment processor', relevance: 'De-facto local rail for online payments' },
  ],

  // Americas / LATAM
  'United States': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with direct acquirer access', relevance: 'Top choice for global enterprise brands operating in the US' },
    { name: 'Stripe',         type: 'Aggregator + Gateway', description: 'Developer-first PSP, dominant in US digital-native commerce', relevance: '#1 PSP for US SaaS / marketplaces' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with deep enterprise tooling', relevance: 'Strong fit for cross-border merchants in the US' },
    { name: 'Cybersource',    type: 'Gateway',              description: 'Visa-owned enterprise gateway', relevance: 'Standard gateway for enterprise merchants on legacy acquirers' },
    { name: 'Fiserv',         type: 'Acquirer + Gateway',   description: 'Largest US merchant acquirer (First Data)', relevance: 'Top-3 acquirer by US volume' },
    { name: 'Global Payments', type: 'Acquirer + Gateway',  description: 'Top-3 US merchant acquirer with global reach', relevance: 'Enterprise + mid-market US acquiring' },
  ],
  'Canada': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with direct acquirer access', relevance: 'Default for global brands operating in Canada' },
    { name: 'Stripe',         type: 'Aggregator + Gateway', description: 'Developer-first PSP, strong in Canadian SMB / digital-native', relevance: 'Top PSP for Canadian SaaS / marketplaces' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Canadian acceptance', relevance: 'Strong fit for cross-border CAD merchants' },
    { name: 'Cybersource',    type: 'Gateway',              description: 'Visa-owned enterprise gateway', relevance: 'Standard gateway for enterprise on legacy Canadian acquirers' },
    { name: 'Fiserv',         type: 'Acquirer + Gateway',   description: 'Major US/CA merchant acquirer', relevance: 'Top acquirer for cross-border US/CA merchants' },
    { name: 'Global Payments', type: 'Acquirer + Gateway',  description: 'Top-3 acquirer with Canadian network coverage', relevance: 'Enterprise Canadian acquiring + Interac access' },
  ],
  'Mexico': [
    { name: 'Prosa',         type: 'Local Acquirer / Processor', description: 'Mexican domestic card switch, runs ~70% of Mexican card txns', relevance: 'Required for best decline rates on Mexican cards' },
    { name: 'BBVA Openpay',  type: 'Aggregator + Gateway',       description: 'BBVA-owned Mexican PSP', relevance: 'Strong bank-backed PSP with OXXO Pay + SPEI integration' },
    { name: 'Afirme',        type: 'Local Acquirer',             description: 'Mexican card acquirer with SME focus', relevance: 'Mid-market Mexican acquiring with installment plans' },
    { name: 'EVO Cards',     type: 'Acquirer',                   description: 'Mexican card acquirer (now Global Payments)', relevance: 'Mass-market Mexican acquiring footprint' },
    { name: 'ARCUS',         type: 'A2A + Bill-pay',             description: 'Mexican fintech enabling SPEI + bill-pay rails', relevance: 'Best SPEI + utility-pay coverage in Mexico' },
    { name: 'dLocal',        type: 'Cross-border PSP',           description: 'Cross-border PSP for emerging markets', relevance: 'Global merchants entering Mexico via single contract' },
    { name: 'EBANX',         type: 'Cross-border PSP',           description: 'LATAM-focused cross-border PSP', relevance: 'Cross-border specialist with deep Mexican APM coverage' },
  ],
  'Brazil': [
    { name: 'Cielo',        type: 'Local Acquirer', description: 'Brazil\'s #1 card acquirer (Bradesco + BB JV)', relevance: 'Largest Brazilian acquirer by volume' },
    { name: 'Rede',         type: 'Local Acquirer', description: 'Itaú-owned Brazilian card acquirer', relevance: '#2 Brazilian acquirer; native Itaú Pix integration' },
    { name: 'PagSeguro',    type: 'Acquirer + Aggregator', description: 'SME-focused Brazilian PSP (NYSE: PAGS)', relevance: 'Dominant SME / marketplace PSP in Brazil' },
    { name: 'Mercado Pago', type: 'Wallet + Acquirer', description: 'Mercado Libre\'s payment arm', relevance: '#1 wallet in Brazil; Boleto + Pix native' },
    { name: 'EBANX',        type: 'Cross-border PSP', description: 'LATAM cross-border specialist', relevance: 'Cross-border merchants entering Brazil via single contract' },
    { name: 'PicPay',       type: 'Wallet + Acquirer', description: 'Brazilian P2P + e-commerce wallet', relevance: 'Growing wallet adoption in mass-market e-commerce' },
    { name: 'Itaú',         type: 'Bank + A2A', description: 'Largest Brazilian private bank', relevance: 'Direct Pix integration + premium card issuer' },
    { name: 'Vindi',        type: 'Subscription Gateway', description: 'Brazilian recurring-billing specialist', relevance: 'Standard gateway for Brazilian subscription verticals' },
  ],
  'Colombia': [
    { name: 'PayU',   type: 'Aggregator + Gateway', description: 'Global PSP with deep LATAM acquiring', relevance: 'Top Colombian PSP with PSE-native integration' },
    { name: 'Wompi',  type: 'Aggregator + Gateway', description: 'Bancolombia-owned Colombian PSP', relevance: 'SME-focused Colombian PSP with mass-market reach' },
    { name: 'Bamboo', type: 'Aggregator + Gateway', description: 'Colombian PSP with PSE specialisation', relevance: 'Strong PSE / bank-transfer coverage' },
  ],
  'Chile': [
    { name: 'Fintoc', type: 'A2A',         description: 'Chilean account-to-account API for instant bank payments', relevance: 'Leading A2A alternative to Webpay for digital-native merchants' },
    { name: 'dLocal', type: 'Cross-border PSP', description: 'Cross-border PSP for emerging markets', relevance: 'Global merchants entering Chile via single contract' },
  ],
  'Argentina': [
    { name: 'Mercado Pago', type: 'Wallet + Acquirer', description: 'Mercado Libre\'s payment arm, dominant in Argentina', relevance: '#1 wallet + acquirer in Argentina' },
    { name: 'dLocal',       type: 'Cross-border PSP',  description: 'Cross-border PSP for emerging markets', relevance: 'Cross-border specialist for USD settlement on Argentine txns' },
  ],
  'Peru': [
    { name: 'PayU',     type: 'Aggregator + Gateway', description: 'Global PSP with deep LATAM acquiring', relevance: 'Top international PSP locally' },
    { name: 'Powerpay', type: 'BNPL + Aggregator',    description: 'Peruvian BNPL + payment specialist', relevance: 'Top BNPL provider in Peru' },
    { name: 'Izipay',   type: 'Local Acquirer',       description: 'Peruvian card acquirer (Niubiz / BBVA-Telefónica spinoff)', relevance: 'Largest Peruvian card acquirer' },
  ],

  // Europe
  'United Kingdom': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with direct UK acquirer access', relevance: 'Default for global enterprise brands operating in the UK' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP HQ\'d in the UK', relevance: 'Strong fit for cross-border UK merchants; native local acquiring' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for legacy enterprise UK merchants' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'UK/EU PSP with strong APM coverage', relevance: 'Mid-market PSP with deep Open Banking coverage' },
  ],
  'Germany': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with EU acquirer access', relevance: 'Default for global enterprise brands operating in Germany' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature German acceptance', relevance: 'Strong fit for cross-border merchants entering Germany' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on legacy German acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with strong invoice / Klarna integrations', relevance: 'Mid-market PSP with invoice + SEPA expertise' },
  ],
  'France': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with French CB acquirer access', relevance: 'Default for global enterprise brands operating in France' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature French acceptance', relevance: 'Strong fit for cross-border merchants entering France' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on legacy French acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with strong French APM coverage', relevance: 'Mid-market PSP with deep CB + SEPA expertise' },
  ],
  'Spain': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Spanish acquirer access', relevance: 'Default for global enterprise brands operating in Spain' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Spanish acceptance', relevance: 'Strong fit for cross-border merchants entering Spain' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on legacy Spanish acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with Bizum + SEPA coverage', relevance: 'Mid-market PSP with deep Iberian APM expertise' },
  ],
  'Netherlands': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP HQ\'d in the Netherlands', relevance: 'Default for global enterprise brands; native iDEAL access' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Dutch acceptance', relevance: 'Strong fit for cross-border merchants entering NL' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on Dutch acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with iDEAL + Klarna coverage', relevance: 'Mid-market PSP with deep iDEAL routing' },
  ],
  'Italy': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Italian acquirer access', relevance: 'Default for global enterprise brands operating in Italy' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Italian acceptance', relevance: 'Strong fit for cross-border merchants entering Italy' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on legacy Italian acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with Italian APM coverage', relevance: 'Mid-market PSP with Satispay / PostePay routing' },
  ],
  'Poland': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Polish BLIK access', relevance: 'Default for global enterprise brands operating in Poland' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Polish acceptance', relevance: 'Strong fit for cross-border merchants entering Poland' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on legacy Polish acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with native BLIK + Przelewy24 routing', relevance: 'Mid-market PSP with deep Polish APM expertise' },
  ],
  'Sweden': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Swedish acquirer access', relevance: 'Default for global enterprise brands operating in Sweden' },
    { name: 'Checkout.com',   type: 'Aggregator + Gateway', description: 'Global PSP with mature Swedish acceptance', relevance: 'Strong fit for cross-border merchants entering Sweden' },
    { name: 'ACI Worldwide',  type: 'Gateway',              description: 'Enterprise payments processor', relevance: 'Standard gateway for enterprise merchants on Swedish acquirers' },
    { name: 'Ecommpay',       type: 'Aggregator + Gateway', description: 'EU PSP with Klarna + Swish + Trustly coverage', relevance: 'Mid-market PSP with deep Nordic APM expertise' },
  ],

  // APAC
  'Japan': [
    { name: 'Adyen',        type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Japanese acquirer access', relevance: 'Default for global enterprise brands operating in Japan' },
    { name: 'Checkout.com', type: 'Aggregator + Gateway', description: 'Global PSP with mature Japanese acceptance', relevance: 'Strong fit for cross-border merchants entering Japan' },
    { name: 'Airwallex',    type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with deep Japan coverage', relevance: 'Top APAC PSP for cross-border merchants entering Japan' },
    { name: 'Do Payment',   type: 'Aggregator + Gateway', description: 'APAC-focused PSP with local Japan licensing', relevance: 'Mid-market APAC PSP with Konbini + LINE Pay coverage' },
  ],
  'South Korea': [
    { name: 'Adyen',        type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Korean acquirer access', relevance: 'Default for global enterprise brands operating in Korea' },
    { name: 'Checkout.com', type: 'Aggregator + Gateway', description: 'Global PSP with mature Korean acceptance', relevance: 'Strong fit for cross-border merchants entering Korea' },
    { name: 'Airwallex',    type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with deep Korea coverage', relevance: 'Top APAC PSP for cross-border merchants entering Korea' },
  ],
  'India': [
    { name: 'Airwallex',  type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with growing India coverage', relevance: 'Top APAC PSP for cross-border merchants entering India' },
    { name: 'Do Payment', type: 'Aggregator + Gateway', description: 'APAC-focused PSP with India licensing', relevance: 'Mid-market APAC PSP with UPI + RuPay coverage' },
    { name: 'Razorpay',   type: 'Aggregator + Gateway', description: 'Indian-native PSP, UPI + RuPay native', relevance: 'Top local PSP for Indian merchants by volume' },
  ],
  'Indonesia': [
    { name: 'Airwallex',  type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with growing Indonesia coverage', relevance: 'Top APAC PSP for cross-border merchants entering Indonesia' },
    { name: 'Do Payment', type: 'Aggregator + Gateway', description: 'APAC-focused PSP with Indonesia licensing', relevance: 'Mid-market APAC PSP with VA + e-wallet coverage' },
    { name: 'Xendit',     type: 'Aggregator + Gateway', description: 'Indonesia-HQ\'d SEA PSP', relevance: 'Top local PSP for Indonesian merchants by volume' },
  ],
  'Singapore': [
    { name: 'Airwallex',  type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with deep Singapore coverage', relevance: 'Top APAC PSP for Singaporean and cross-border merchants' },
    { name: 'Do Payment', type: 'Aggregator + Gateway', description: 'APAC-focused PSP with Singapore licensing', relevance: 'Mid-market APAC PSP with PayNow + GrabPay coverage' },
    { name: 'Adyen',      type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Singapore HQ for APAC', relevance: 'Default for global enterprise brands in APAC' },
    { name: 'Stripe',     type: 'Aggregator + Gateway', description: 'Developer-first PSP with strong Singapore acceptance', relevance: 'Top PSP for Singaporean digital-native merchants' },
  ],
  'Australia': [
    { name: 'Adyen',        type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Australian acquirer access', relevance: 'Default for global enterprise brands operating in Australia' },
    { name: 'Checkout.com', type: 'Aggregator + Gateway', description: 'Global PSP with mature Australian acceptance', relevance: 'Strong fit for cross-border merchants entering Australia' },
    { name: 'Airwallex',    type: 'Aggregator + Gateway', description: 'Australia-founded APAC PSP', relevance: 'Top APAC PSP for Australian merchants' },
    { name: 'Stripe',       type: 'Aggregator + Gateway', description: 'Developer-first PSP with strong AU acceptance', relevance: 'Top PSP for Australian digital-native merchants' },
  ],
  'Philippines': [
    { name: 'Airwallex',  type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with growing Philippines coverage', relevance: 'Top APAC PSP for cross-border merchants entering PH' },
    { name: 'Do Payment', type: 'Aggregator + Gateway', description: 'APAC-focused PSP with Philippines licensing', relevance: 'Mid-market APAC PSP with GCash + Maya coverage' },
  ],
  'Thailand': [
    { name: 'Airwallex',  type: 'Aggregator + Gateway', description: 'APAC-HQ\'d global PSP with growing Thailand coverage', relevance: 'Top APAC PSP for cross-border merchants entering TH' },
    { name: 'Do Payment', type: 'Aggregator + Gateway', description: 'APAC-focused PSP with Thailand licensing', relevance: 'Mid-market APAC PSP with PromptPay + TrueMoney coverage' },
    { name: '2C2P',       type: 'Aggregator + Gateway', description: 'SEA-focused PSP with strong Thailand presence', relevance: 'Top local PSP for Thai merchants by volume' },
  ],
}

export function getMetrics(country) {
  return COUNTRY_METRICS[country] || null
}
export function getLocalPMs(country) {
  return COUNTRY_LOCAL_PMS[country] || null
}
export function getPie(country) {
  return COUNTRY_PIE[country] || null
}
export function getProTips(country) {
  return COUNTRY_PRO_TIPS[country] || null
}
export function getProviders(country) {
  return COUNTRY_PROVIDERS[country] || null
}
