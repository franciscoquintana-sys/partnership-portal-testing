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

// Vertical tags per provider — used by SlideCountryDetailPage to rank
// the partner list against the merchant's detected vertical (digital
// goods, retail, travel, etc.). 'general' = works across all verticals.
// A provider missing from this map is treated as 'general'.
export const PROVIDER_VERTICALS = {
  // Global PSPs
  'Adyen':            ['general', 'retail', 'marketplace', 'travel', 'digital_goods', 'subscription_saas', 'streaming'],
  'Stripe':           ['general', 'subscription_saas', 'marketplace', 'streaming', 'retail', 'digital_goods'],
  'Checkout.com':     ['general', 'digital_goods', 'gaming', 'travel', 'marketplace', 'retail', 'streaming', 'crypto', 'fintech'],
  'Worldpay':         ['general', 'digital_goods', 'gaming', 'travel', 'retail', 'marketplace'],
  'Worldline':        ['general', 'retail', 'travel', 'marketplace'],
  'Cybersource':      ['general', 'retail', 'travel'],
  'Fiserv':           ['general', 'retail'],
  'Global Payments':  ['general', 'retail', 'travel'],
  'ACI Worldwide':    ['general', 'retail', 'subscription_saas'],
  'Ecommpay':         ['general', 'retail', 'digital_goods', 'gaming', 'travel'],
  'Airwallex':        ['general', 'subscription_saas', 'marketplace', 'digital_goods', 'streaming'],
  'PayU':             ['general', 'retail', 'marketplace', 'travel'],
  // Cross-border emerging-markets PSPs
  'dLocal':           ['general', 'digital_goods', 'streaming', 'subscription_saas', 'travel', 'retail'],
  'EBANX':            ['general', 'digital_goods', 'streaming', 'subscription_saas', 'retail', 'travel'],
  'PayPal':           ['general', 'retail', 'marketplace', 'digital_goods'],
  // LATAM
  'Mercado Pago':     ['general', 'retail', 'marketplace'],
  'Cielo':            ['general', 'retail', 'travel'],
  'Rede':             ['general', 'retail'],
  'PagSeguro':        ['general', 'retail', 'marketplace'],
  'PicPay':           ['general', 'retail'],
  'Vindi':            ['subscription_saas', 'streaming'],
  'Itaú':             ['general', 'retail', 'fintech'],
  'Stone':            ['general', 'retail'],
  'Prosa':            ['general', 'retail'],
  'BBVA Openpay':     ['general', 'retail'],
  'Afirme':           ['general', 'retail'],
  'EVO Cards':        ['general', 'retail'],
  'ARCUS':            ['fintech', 'subscription_saas'],
  'Wompi':            ['general', 'retail', 'marketplace'],
  'Bamboo':           ['general', 'retail'],
  'Powerpay':         ['retail', 'marketplace'],
  'Izipay':           ['general', 'retail'],
  'Niubiz':           ['general', 'retail'],
  'Fintoc':           ['subscription_saas', 'fintech'],
  'Khipu':            ['subscription_saas', 'fintech'],
  'Transbank':        ['general', 'retail'],
  'Kushki':           ['general', 'retail', 'digital_goods'],
  'Prisma Medios de Pago': ['general', 'retail'],
  'Decidir':          ['general', 'retail'],
  // EU local
  'Klarna':           ['retail', 'digital_goods', 'travel', 'general'],
  'Trustly':          ['digital_goods', 'gaming', 'retail', 'travel', 'fintech', 'crypto'],
  'Mollie':           ['general', 'subscription_saas', 'retail'],
  'Nexi':             ['general', 'retail'],
  'Buckaroo':         ['general', 'retail'],
  'Przelewy24':       ['general', 'retail', 'digital_goods'],
  'Tpay':             ['general', 'retail'],
  'Redsys':           ['general', 'retail'],
  'BNP Paribas':      ['general', 'retail', 'travel'],
  'GoCardless':       ['subscription_saas', 'streaming', 'fintech'],
  'Swish':            ['general', 'retail'],
  // APAC
  'Razorpay':         ['general', 'retail', 'subscription_saas', 'marketplace', 'digital_goods'],
  'PayU India':       ['general', 'retail', 'marketplace'],
  'Cashfree':         ['general', 'retail', 'marketplace'],
  'CCAvenue':         ['general', 'retail'],
  'Xendit':           ['general', 'retail', 'marketplace', 'subscription_saas', 'digital_goods'],
  'Midtrans':         ['general', 'retail', 'marketplace'],
  'DOKU':             ['general', 'retail'],
  'iPay88':           ['general', 'retail'],
  '2C2P':             ['general', 'retail', 'digital_goods', 'travel'],
  'Opn Payments':     ['general', 'retail', 'subscription_saas'],
  'Omise':            ['general', 'retail', 'subscription_saas'],
  'PayMongo':         ['general', 'retail', 'subscription_saas'],
  'GMO Payment Gateway':['general','retail','digital_goods','travel'],
  'SBPS':             ['general', 'retail', 'streaming'],
  'KG Inicis':        ['general', 'retail'],
  'Toss Payments':    ['general', 'retail', 'subscription_saas', 'digital_goods'],
  'NICEPay':          ['general', 'retail'],
  'Eway':             ['general', 'retail'],
  'Tyro':             ['general', 'retail'],
  'Maya Business':    ['general', 'retail'],
  'Do Payment':       ['general', 'retail'],
  'Boku':             ['digital_goods', 'streaming', 'subscription_saas'],
  // MENAT
  'HyperPay':         ['general', 'retail'],
  'Paymob':           ['general', 'retail'],
  'Moyasar':          ['general', 'retail', 'subscription_saas'],
  'Telr':             ['general', 'retail'],
  'Tap':              ['general', 'retail'],
  'PayTabs':          ['general', 'retail'],
  'Geidea':           ['general', 'retail'],
  'Network International': ['general', 'retail', 'travel'],
  'MyFatoorah':       ['general', 'retail'],
  'BenefitPay':       ['general', 'retail'],
  'Thawani':          ['general', 'retail'],
  'CMI':              ['general', 'retail'],
  'Naps':             ['general', 'retail'],
  'PayZone':          ['general', 'retail'],
  'Fawry':            ['general', 'retail'],
  'Vodafone Cash':    ['general', 'retail'],
  'CIB':              ['general', 'retail'],
  'iyzico':           ['general', 'retail', 'digital_goods'],
  'PayTR':            ['general', 'retail'],
  'Param':            ['general', 'retail', 'fintech'],
  'BKM Express':      ['general', 'retail', 'marketplace'],
  'Sipay':            ['digital_goods', 'gaming', 'general'],
  'QNB':              ['general', 'retail'],
  'KNET':             ['general', 'retail'],
  'Tabby':            ['retail', 'digital_goods', 'general'],
  'Tamara':           ['retail', 'digital_goods', 'general'],
  'MadfooatCom':      ['general', 'fintech'],
  'Mashreq Neopay':   ['general', 'retail'],
  'Qi Card':          ['general', 'retail'],
  'Zain Cash':        ['general', 'retail', 'fintech'],
  // Toss / KakaoPay / Naver Pay style wallets
  'KakaoPay':         ['general', 'retail'],
  'Naver Pay':        ['general', 'retail', 'marketplace'],
  'PayPay':           ['general', 'retail'],
  'LINE Pay':         ['general', 'retail'],
  'GCash':            ['general', 'retail'],
  'Maya':             ['general', 'retail'],
  'Yape':             ['general', 'retail'],
  'Plin':             ['general', 'retail'],
  // Africa
  'Flutterwave':      ['general', 'retail', 'marketplace', 'digital_goods'],
  'Cellulant':        ['general', 'retail', 'fintech'],
  'DPO Group':        ['general', 'retail', 'travel'],
  'Paystack':         ['general', 'retail', 'subscription_saas'],
  'Interswitch':      ['general', 'retail'],
  'Yoco':             ['general', 'retail'],
  'Ozow':             ['general', 'retail', 'fintech'],
  'M-PESA':           ['general', 'retail', 'fintech'],
  // Additional market leaders (post-Yuno-bias rewrite)
  'Stone':            ['general', 'retail'],
  'Getnet':           ['general', 'retail'],
  'Bold':             ['general', 'retail'],
  'Nequi':            ['general', 'retail', 'fintech'],
  'Daviplata':        ['general', 'retail', 'fintech'],
  'Modo':             ['general', 'retail'],
  'Naranja X':        ['general', 'retail'],
  'Flow':             ['general', 'retail'],
  'Conekta':          ['general', 'retail', 'subscription_saas'],
  'Clip':             ['general', 'retail'],
  'Moneris':          ['general', 'retail'],
  'Chase Paymentech': ['general', 'retail', 'travel'],
  'JPMorgan Payments':['general', 'retail', 'travel'],
  'Square':           ['general', 'retail'],
  'Block':            ['general', 'retail'],
  'Barclaycard':      ['general', 'retail', 'travel'],
  'Lloyds Cardnet':   ['general', 'retail'],
  'PayPal':           ['general', 'retail', 'marketplace', 'digital_goods'],
  'Lyf Pay':          ['general', 'retail'],
  'Crédit Agricole':  ['general', 'retail'],
  'Computop':         ['general', 'retail', 'digital_goods', 'travel'],
  'Saferpay':         ['general', 'retail', 'travel'],
  'CaixaBank Payments':['general', 'retail'],
  'Bizum':            ['general', 'retail'],
  'ING':              ['general', 'retail'],
  'Bancomat Pay':     ['general', 'retail'],
  'Satispay':         ['general', 'retail'],
  'BLIK':             ['general', 'retail', 'digital_goods'],
  'eService':         ['general', 'retail'],
  'Swish':            ['general', 'retail'],
  'Bambora':          ['general', 'retail'],
  'GMO PG':           ['general','retail','digital_goods','travel'],
  'SMBC':             ['general', 'retail'],
  'Mitsubishi UFJ NICOS': ['general', 'retail'],
  'Komoju':           ['digital_goods', 'subscription_saas', 'general'],
  'NHN KCP':          ['general', 'retail'],
  'BillDesk':         ['general', 'retail', 'subscription_saas'],
  'Paytm':            ['general', 'retail'],
  'PhonePe':          ['general', 'retail', 'fintech'],
  'Faspay':           ['general', 'retail'],
  'NETS':             ['general', 'retail'],
  'GrabPay':          ['general', 'retail', 'food_delivery'],
  'Dragonpay':        ['general', 'retail'],
  'KBank':            ['general', 'retail'],
  'SCB':              ['general', 'retail'],
  'TrueMoney':        ['general', 'retail', 'digital_goods'],
  'Magnati':          ['general', 'retail'],
  'Mada':             ['general', 'retail'],
  'urpay':            ['general', 'retail'],
  'CrediMax':         ['general', 'retail'],
  'BankMuscat Mu\'amalat': ['general', 'retail'],
  'Doha Bank':        ['general', 'retail'],
  'CBQ Pay':          ['general', 'retail'],
  'NBE':              ['general', 'retail'],
  'M2T':              ['general', 'retail', 'fintech'],
  'BCP':              ['general', 'retail'],
  'Garanti BBVA Sanal POS': ['general', 'retail'],
  'Akbank Sanal POS': ['general', 'retail'],
  'NBK':              ['general', 'retail'],
  'Boubyan Pay':      ['general', 'retail'],
  'FastPay':          ['general', 'retail', 'fintech'],
}

// Regional fallback used when a country has no curated COUNTRY_PROVIDERS
// row. Pan-regional names that work for any merchant entering the region.
// Slide 10 falls through: COUNTRY_PROVIDERS[country] → REGION_PROVIDERS[region]
// → empty. Keep these to 5 strong, well-known names per region.
export const REGION_PROVIDERS = {
  Americas: [
    { name: 'Fiserv',           type: 'Acquirer + Gateway',   description: 'Largest US merchant acquirer (ex-First Data)', relevance: '#1 acquirer in the US by volume' },
    { name: 'JPMorgan Payments', type: 'Acquirer + Gateway',  description: 'Chase Paymentech — top bank-owned acquirer', relevance: 'Top-2 US acquirer; largest issuer' },
    { name: 'Worldpay',         type: 'Acquirer + Gateway',   description: 'FIS-owned global acquirer', relevance: 'Top-3 US acquirer; strong cross-border + verticals' },
    { name: 'Stripe',           type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for US SaaS / marketplaces / digital-native' },
    { name: 'Adyen',            type: 'Aggregator + Gateway', description: 'Global enterprise PSP', relevance: 'Default for global enterprise brands in NA' },
  ],
  LATAM: [
    { name: 'Mercado Pago',     type: 'Wallet + Acquirer',    description: "Mercado Libre's payment arm", relevance: '#1 wallet + top acquirer across LATAM' },
    { name: 'PayU',             type: 'Aggregator + Gateway', description: 'PSP with deep LATAM acquiring', relevance: 'Top local PSP across multiple LATAM markets' },
    { name: 'Kushki',           type: 'Aggregator + Gateway', description: 'Pan-LATAM PSP with native acquiring', relevance: 'Top digital-native PSP across Andean LATAM' },
    { name: 'dLocal',           type: 'Cross-border PSP',     description: 'LATAM cross-border specialist (NASDAQ)', relevance: '#1 cross-border PSP for LATAM' },
    { name: 'EBANX',            type: 'Cross-border PSP',     description: 'LATAM cross-border PSP', relevance: 'Top cross-border PSP for LATAM APM coverage' },
  ],
  Europe: [
    { name: 'Worldline',        type: 'Acquirer + Gateway',   description: 'French-rooted EU acquirer/PSP', relevance: '#1 European acquirer by transaction volume' },
    { name: 'Nexi',             type: 'Acquirer + Gateway',   description: 'Italian-rooted EU acquirer (PayTech / SIA / Nets merger)', relevance: 'Top-3 European acquirer by volume' },
    { name: 'Adyen',            type: 'Aggregator + Gateway', description: 'Global enterprise PSP HQ\'d in the Netherlands', relevance: 'Default for global enterprise brands in Europe' },
    { name: 'Stripe',           type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for European SaaS / digital-native' },
    { name: 'Klarna',           type: 'BNPL + Wallet',        description: 'Swedish-rooted dominant EU BNPL', relevance: 'Default BNPL across DACH + Nordics' },
  ],
  APAC: [
    { name: 'Adyen',            type: 'Aggregator + Gateway', description: 'Global enterprise PSP with Singapore APAC HQ', relevance: 'Default for global enterprise brands in APAC' },
    { name: 'Stripe',           type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: 'Top PSP for APAC SaaS / digital-native' },
    { name: '2C2P',             type: 'Aggregator + Gateway', description: 'SEA-focused PSP HQ\'d in Singapore', relevance: '#1 SEA PSP with deep APAC APM coverage' },
    { name: 'GMO Payment Gateway', type: 'Aggregator + Gateway', description: 'Top Japanese PSP', relevance: '#1 PSP in Japan; major APAC presence' },
    { name: 'Razorpay',         type: 'Aggregator + Gateway', description: 'Indian-native PSP, UPI + RuPay native', relevance: '#1 PSP in India by merchant count' },
  ],
  MENAT: [
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer covering 50+ markets', relevance: '#1 regional acquirer across MENAT' },
    { name: 'HyperPay',         type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional MENA gateway', relevance: 'Largest local gateway by merchant coverage' },
    { name: 'Geidea',           type: 'Acquirer + Gateway',   description: 'SAMA-licensed Saudi acquirer + processor', relevance: 'Top regional acquirer for SMEs + enterprises' },
    { name: 'Magnati',          type: 'Acquirer + Gateway',   description: 'First Abu Dhabi Bank-owned payments unit', relevance: 'Top UAE bank-owned acquirer' },
    { name: 'PayTabs',          type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Top mid-market PSP across MENAT' },
  ],
  Africa: [
    { name: 'Flutterwave',      type: 'Aggregator + Gateway', description: 'Pan-African PSP HQ\'d in Nigeria', relevance: '#1 pan-African PSP — 30+ African markets' },
    { name: 'Paystack',         type: 'Aggregator + Gateway', description: 'Stripe-owned Nigerian PSP', relevance: '#1 PSP in Nigeria; expanding across Africa' },
    { name: 'Interswitch',      type: 'Switch + Acquirer',    description: 'Nigerian-rooted pan-African switch', relevance: 'Operates Verve scheme + dominant local rails' },
    { name: 'Cellulant',        type: 'Aggregator + Gateway', description: 'Pan-African PSP with mobile-money rails', relevance: 'Top PSP for African mobile-money flows' },
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer (DPO Group-owner)', relevance: 'Top regional acquirer across Africa' },
  ],
}

// Rich provider rows per country for the connections table. Each entry:
//   { name, type, description, relevance, logo? }
// `logo` is a path under /logos/providers/ if we have a white-on-dark
// silhouette asset. Otherwise the slide renders the provider name as a
// styled wordmark.
export const COUNTRY_PROVIDERS = {
  'Saudi Arabia': [
    { name: 'HyperPay',  type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional MENA gateway', relevance: 'Largest local gateway by merchant coverage' },
    { name: 'Geidea',    type: 'Acquirer + Gateway',   description: 'SAMA-licensed Saudi acquirer + processor', relevance: 'Top Saudi acquirer for SMEs + enterprises' },
    { name: 'Moyasar',   type: 'Aggregator + Gateway', description: 'Saudi-built, SAMA-licensed fast-growing gateway', relevance: 'Default for KSA startups and digital-natives' },
    { name: 'PayTabs',   type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Top mid-market PSP in KSA' },
    { name: 'Mada',      type: 'National Scheme + Acquirer', description: 'SAMA-run national debit scheme', relevance: 'Mandatory rail for accepting Saudi debit cards' },
  ],
  'United Arab Emirates': [
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer covering 50+ markets', relevance: '#1 regional acquirer in the UAE' },
    { name: 'Magnati',      type: 'Acquirer + Gateway', description: 'First Abu Dhabi Bank-owned payments unit', relevance: 'Top UAE bank-owned acquirer' },
    { name: 'Telr',         type: 'Aggregator + Gateway', description: 'Regional GCC PSP HQ\'d in Dubai', relevance: '350K merchants across MENA' },
    { name: 'Tap',          type: 'Aggregator + Gateway', description: 'Kuwait/UAE-based GCC PSP', relevance: '~1bn txn/year across MENA' },
    { name: 'Checkout.com', type: 'Aggregator + Gateway', description: 'Global PSP with high-performance MENA acquiring', relevance: 'Default for cross-border + enterprise brands' },
  ],
  'Turkey': [
    { name: 'iyzico',      type: 'Aggregator + Gateway', description: 'End-to-end Turkish payment platform', relevance: '#1 e-commerce PSP in Turkey' },
    { name: 'Garanti BBVA Sanal POS', type: 'Bank Acquirer', description: 'Garanti BBVA-owned acquirer', relevance: 'Top bank-owned acquirer by Turkish card volume' },
    { name: 'PayTR',       type: 'Aggregator + Gateway', description: 'Local Turkish virtual POS + online payments', relevance: 'Dominant among local SME e-commerce' },
    { name: 'Param',       type: 'Aggregator + Gateway', description: 'Full-stack Turkish fintech', relevance: 'First BDDK-licensed Turkish e-money institution' },
    { name: 'Akbank Sanal POS', type: 'Bank Acquirer',   description: 'Akbank-owned virtual POS', relevance: 'Top-3 Turkish bank acquirer' },
  ],

  // MENAT, remaining T2 / T3 markets
  'Qatar': [
    { name: 'QNB',     type: 'Bank Acquirer',        description: 'Qatar National Bank merchant acquiring', relevance: '#1 local acquirer by market share' },
    { name: 'Doha Bank', type: 'Bank Acquirer',      description: 'Doha Bank merchant services', relevance: 'Top-3 Qatari acquirer' },
    { name: 'CBQ Pay', type: 'Bank Acquirer',        description: 'Commercial Bank of Qatar merchant unit', relevance: 'Top-3 local bank acquirer' },
    { name: 'Tap',     type: 'Aggregator + Gateway', description: 'Kuwait/UAE-based GCC PSP', relevance: 'Top international PSP in Qatar' },
    { name: 'PayTabs', type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Strong SME footprint in Qatar' },
  ],
  'Kuwait': [
    { name: 'KNET',        type: 'National Scheme + A2A', description: 'Bank-consortium-run national debit scheme', relevance: 'Mandatory rail for Kuwaiti debit cards' },
    { name: 'Tap',         type: 'Aggregator + Gateway', description: 'Kuwait-founded GCC PSP', relevance: 'Largest local PSP; deep KNET integration' },
    { name: 'MyFatoorah',  type: 'Aggregator + Gateway', description: 'Kuwaiti mass-market PSP', relevance: 'Strong SME penetration; KNET-native' },
    { name: 'NBK',         type: 'Bank Acquirer',         description: 'National Bank of Kuwait merchant services', relevance: '#1 Kuwaiti bank-owned acquirer' },
    { name: 'Boubyan Pay', type: 'Bank Acquirer',         description: 'Boubyan Bank payments arm', relevance: 'Top-3 Kuwaiti bank acquirer' },
  ],
  'Bahrain': [
    { name: 'BenefitPay', type: 'Local Wallet + A2A', description: 'National wallet operated by BENEFIT', relevance: '~47% of Bahraini e-commerce; table-stakes' },
    { name: 'CrediMax',   type: 'Bank Acquirer',      description: 'National Bank of Bahrain-owned acquirer', relevance: '#1 Bahraini card acquirer' },
    { name: 'Tap',        type: 'Aggregator + Gateway', description: 'GCC-wide PSP', relevance: 'Top international PSP locally' },
    { name: 'PayTabs',    type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Mid-market SME PSP in Bahrain' },
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer', relevance: 'Major regional acquirer in Bahrain' },
  ],
  'Oman': [
    { name: "BankMuscat Mu'amalat", type: 'Bank Acquirer', description: 'BankMuscat\'s merchant acquiring arm', relevance: '#1 Omani bank-owned acquirer' },
    { name: 'Thawani',              type: 'Aggregator + Gateway', description: 'CBO-licensed Omani fintech-sandbox graduate', relevance: 'Top local PSP serving Omani merchants' },
    { name: 'Tap',                  type: 'Aggregator + Gateway', description: 'GCC PSP', relevance: 'Default checkout for many Omani e-commerce sites' },
    { name: 'PayTabs',              type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Mid-market PSP in Oman' },
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer', relevance: 'Top regional acquirer in Oman' },
  ],
  'Jordan': [
    { name: 'MadfooatCom', type: 'Bill-pay + A2A',    description: 'Jordan\'s national bill-payment switch (eFAWATEERcom)', relevance: 'Mandatory for utility + government flows' },
    { name: 'HyperPay', type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Top regional PSP in Jordan' },
    { name: 'Tap',      type: 'Aggregator + Gateway', description: 'GCC PSP', relevance: 'Default for cross-border merchants entering Jordan' },
    { name: 'PayTabs',  type: 'Aggregator + Gateway', description: 'Riyadh-HQ\'d regional gateway', relevance: 'Mid-market PSP, SME-friendly' },
    { name: 'Network International', type: 'Acquirer + Gateway', description: 'UAE-HQ\'d MEA acquirer', relevance: 'Major regional acquirer in Jordan' },
  ],
  'Egypt': [
    { name: 'Paymob',                type: 'Aggregator + Gateway', description: 'Egypt-founded local PSP', relevance: '#1 PSP in Egypt by merchant count' },
    { name: 'Fawry',                 type: 'Cash voucher + Wallet', description: 'Cash + wallet network with 250K+ agents', relevance: 'Mass-market funnel for unbanked Egyptians' },
    { name: 'NBE',                   type: 'Bank Acquirer',         description: 'National Bank of Egypt merchant services', relevance: '#1 Egyptian bank-owned acquirer' },
    { name: 'CIB',                   type: 'Bank Acquirer',         description: 'Commercial International Bank — top private bank', relevance: 'Top private-sector Egyptian acquirer' },
    { name: 'Geidea',                type: 'Acquirer + Gateway',   description: 'Saudi-HQ\'d acquirer with Egyptian footprint', relevance: 'Growing acquirer in Egypt' },
  ],
  'Morocco': [
    { name: 'CMI',  type: 'National Acquirer',     description: 'Centre Monétique Interbancaire — runs all local card acquiring', relevance: 'Mandatory for Moroccan cards' },
    { name: 'Naps', type: 'Aggregator + Gateway', description: 'Local Moroccan PSP for SMEs + marketplaces', relevance: 'Top local PSP for digital-natives' },
    { name: 'PayZone', type: 'Aggregator + Gateway', description: 'Moroccan PSP for utility + digital', relevance: 'Top bill-pay + e-commerce PSP' },
    { name: 'M2T',     type: 'Mobile Wallet',       description: 'Maroc Telecommerce mobile-money + e-payments', relevance: 'Top Moroccan mobile-payments operator' },
    { name: 'BCP',     type: 'Bank Acquirer',       description: 'Banque Centrale Populaire merchant services', relevance: '#1 Moroccan bank-owned acquirer' },
  ],
  'Iraq': [
    { name: 'Qi Card',              type: 'Prepaid + Payroll',   description: 'International Smart Card — dominant payroll/prepaid', relevance: 'Government salaries load here; widest distribution' },
    { name: 'NEC Payment Services', type: 'Acquirer + Gateway',  description: 'Local Iraqi acquirer + processor', relevance: 'De-facto rail for online card payments' },
    { name: 'KI Card',              type: 'Prepaid + Payroll',   description: 'Kurdistan equivalent of Qi Card', relevance: 'Default rail in Erbil and Kurdistan' },
    { name: 'Zain Cash',            type: 'Mobile Wallet',       description: 'Zain Iraq-run mobile money', relevance: 'Leading Iraqi mobile wallet' },
    { name: 'FastPay',              type: 'Mobile Wallet + A2A', description: 'Iraqi A2A + mobile wallet', relevance: 'Top digital-native wallet in Iraq' },
  ],

  // Americas / LATAM
  'United States': [
    { name: 'Fiserv',          type: 'Acquirer + Gateway',   description: 'Largest US merchant acquirer (ex-First Data)', relevance: '#1 US acquirer by transaction volume' },
    { name: 'JPMorgan Payments', type: 'Acquirer + Gateway', description: 'Chase Paymentech — top bank-owned acquirer', relevance: '#2 US acquirer; largest US card issuer' },
    { name: 'Worldpay',        type: 'Acquirer + Gateway',   description: 'FIS-owned global acquirer', relevance: 'Top-3 US acquirer; strong cross-border + verticals' },
    { name: 'Stripe',          type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for US SaaS / marketplaces / digital-native' },
    { name: 'Adyen',           type: 'Aggregator + Gateway', description: 'Global enterprise PSP', relevance: 'Default for global enterprise brands in the US' },
  ],
  'Canada': [
    { name: 'Moneris',         type: 'Acquirer + Gateway',   description: 'BMO + RBC JV — largest Canadian acquirer', relevance: '#1 Canadian acquirer by merchant count' },
    { name: 'Chase Paymentech', type: 'Acquirer + Gateway', description: 'JPMorgan Payments Canada', relevance: 'Top-2 Canadian acquirer by volume' },
    { name: 'Global Payments', type: 'Acquirer + Gateway',  description: 'Top-3 acquirer with Canadian coverage', relevance: 'Enterprise Canadian acquiring + Interac access' },
    { name: 'Stripe',          type: 'Aggregator + Gateway', description: 'Developer-first PSP, strong in Canadian SMB', relevance: 'Top PSP for Canadian SaaS / digital-natives' },
    { name: 'Adyen',           type: 'Aggregator + Gateway', description: 'Global enterprise PSP', relevance: 'Default for global brands operating in Canada' },
  ],
  'Mexico': [
    { name: 'Prosa',         type: 'National Switch + Processor', description: 'Mexican domestic card switch (~70% of card txns)', relevance: 'Required for best decline rates on Mexican cards' },
    { name: 'BBVA Bancomer', type: 'Bank Acquirer',              description: 'BBVA Mexico merchant services', relevance: '#1 Mexican bank-owned acquirer' },
    { name: 'Mercado Pago',  type: 'Wallet + Acquirer',          description: "Mercado Libre's payment arm", relevance: '#1 wallet + top digital acquirer in Mexico' },
    { name: 'Conekta',       type: 'Aggregator + Gateway',       description: 'Mexican-native PSP', relevance: 'Top local PSP for digital-native merchants' },
    { name: 'Clip',          type: 'SMB Acquirer + Wallet',      description: 'Mexican SMB-focused acquirer', relevance: '#1 Mexican SMB-acquirer (1M+ small merchants)' },
  ],
  'Brazil': [
    { name: 'Cielo',        type: 'Acquirer',              description: 'Brazil\'s #1 acquirer (Bradesco + BB JV)', relevance: '#1 Brazilian acquirer by volume' },
    { name: 'Rede',         type: 'Acquirer',              description: 'Itaú-owned acquirer', relevance: '#2 Brazilian acquirer; native Itaú Pix' },
    { name: 'Stone',        type: 'Acquirer + Aggregator', description: 'NASDAQ-listed Brazilian acquirer', relevance: '#3 Brazilian acquirer; SME-leader by merchant count' },
    { name: 'Getnet',       type: 'Acquirer',              description: 'Santander-owned acquirer', relevance: 'Top-4 Brazilian acquirer; bank-backed' },
    { name: 'Mercado Pago', type: 'Wallet + Acquirer',     description: "Mercado Libre's payment arm", relevance: '#1 Brazilian wallet; native Boleto + Pix' },
  ],
  'Colombia': [
    { name: 'PayU',   type: 'Aggregator + Gateway', description: 'PSP with deep LATAM acquiring', relevance: '#1 Colombian PSP — PSE-native integration' },
    { name: 'Wompi',  type: 'Aggregator + Gateway', description: 'Bancolombia-owned Colombian PSP', relevance: 'Top SME-focused Colombian PSP' },
    { name: 'Bold',   type: 'SMB Acquirer + POS',   description: 'Colombian SMB-focused acquirer', relevance: '#1 Colombian SMB-acquirer by merchant count' },
    { name: 'Nequi',  type: 'Wallet + Bank',        description: 'Bancolombia-owned digital wallet/bank', relevance: '20M+ users; dominant Colombian wallet' },
    { name: 'Mercado Pago', type: 'Wallet + Acquirer', description: "Mercado Libre's payment arm", relevance: 'Top wallet + growing acquirer in Colombia' },
  ],
  'Chile': [
    { name: 'Transbank', type: 'National Acquirer',    description: 'Bank-owned acquirer (~70% physical card volume)', relevance: '#1 Chilean acquirer; mandatory for cards' },
    { name: 'Flow',      type: 'Aggregator + Gateway', description: 'Chilean-native PSP', relevance: 'Top local PSP for SMEs + digital-natives' },
    { name: 'Kushki',    type: 'Aggregator + Gateway', description: 'Pan-LATAM PSP with native Chilean acquiring', relevance: 'Top alternative acquirer for enterprises' },
    { name: 'Fintoc',    type: 'A2A',                  description: 'Chilean account-to-account API', relevance: 'Leading A2A alternative to Webpay' },
    { name: 'Khipu',     type: 'A2A',                  description: 'Chilean A2A pioneer (pay-by-bank)', relevance: 'Largest Chilean A2A by merchant count' },
  ],
  'Argentina': [
    { name: 'Mercado Pago', type: 'Wallet + Acquirer', description: "Mercado Libre's payment arm — dominant in AR", relevance: '#1 wallet + top acquirer in Argentina' },
    { name: 'Prisma Medios de Pago', type: 'Acquirer', description: 'Largest Argentine acquirer (ex-Visa/Banelco JV)', relevance: '#1 acquirer for Visa/Cabal volume' },
    { name: 'Decidir',      type: 'Gateway',           description: 'Prisma\'s gateway (now Fiserv Argentina)', relevance: 'Standard gateway for legacy enterprise merchants' },
    { name: 'Modo',         type: 'Bank Wallet + A2A', description: 'JV of 35 Argentine banks — interbank wallet', relevance: 'Dominant Argentine banking-rail wallet' },
    { name: 'Naranja X',    type: 'Wallet + Card',     description: 'Galicia-backed Argentine wallet/card', relevance: 'Top Argentine consumer wallet by users' },
  ],
  'Peru': [
    { name: 'Niubiz',   type: 'National Processor',    description: 'Top Peruvian processor (ex-VisaNet Perú)', relevance: '#1 Peruvian processor for Visa volume' },
    { name: 'Izipay',   type: 'Acquirer',              description: 'Peruvian card acquirer', relevance: '#1 Peruvian card acquirer by merchants' },
    { name: 'Yape',     type: 'Wallet + A2A',          description: 'BCP-run wallet — 15M+ users', relevance: '#1 wallet in Peru; interop with Plin' },
    { name: 'Mercado Pago', type: 'Wallet + Acquirer', description: "Mercado Libre's payment arm", relevance: 'Top digital wallet + growing acquirer' },
    { name: 'PayU',     type: 'Aggregator + Gateway',  description: 'PSP with deep LATAM acquiring', relevance: 'Top international PSP in Peru' },
  ],

  // Europe
  'United Kingdom': [
    { name: 'Worldpay',       type: 'Acquirer + Gateway',  description: 'UK-rooted FIS-owned acquirer', relevance: '#1 UK acquirer by merchant volume' },
    { name: 'Barclaycard',    type: 'Bank Acquirer',        description: 'Barclays\' merchant payments arm', relevance: '#1 UK bank-owned acquirer by issuing footprint' },
    { name: 'Stripe',         type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for UK SaaS / digital-native merchants' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP', relevance: 'Default for global enterprise brands in the UK' },
    { name: 'Lloyds Cardnet', type: 'Bank Acquirer',        description: 'Lloyds Banking Group merchant services', relevance: 'Top-3 UK bank-owned acquirer' },
  ],
  'Germany': [
    { name: 'PayPal',         type: 'Wallet',               description: 'Largest checkout wallet in Germany', relevance: '~28% of German e-commerce — table-stakes' },
    { name: 'Klarna',         type: 'BNPL + Wallet',        description: 'German-rooted BNPL/invoice leader', relevance: 'Dominant invoice + BNPL choice in Germany' },
    { name: 'Worldline',      type: 'Acquirer + Gateway',  description: 'Top EU acquirer (ex-SIX Payment Services)', relevance: '#1 German bank-network acquirer' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP', relevance: 'Default for global enterprise brands in Germany' },
    { name: 'Computop',       type: 'Aggregator + Gateway', description: 'German-rooted PSP for mid-market + enterprise', relevance: 'Top local PSP for digital-goods + travel verticals' },
  ],
  'France': [
    { name: 'Worldline',      type: 'Acquirer + Gateway',  description: 'French-HQ\'d top European acquirer/PSP', relevance: '#1 French acquirer; native CB + SEPA' },
    { name: 'BNP Paribas',    type: 'Bank Acquirer',        description: 'BNP Paribas Personal Finance acquirer', relevance: '#1 French bank-owned acquirer' },
    { name: 'Crédit Agricole', type: 'Bank Acquirer',       description: 'Crédit Agricole merchant services', relevance: 'Top-3 French bank-owned acquirer' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global PSP with French CB acquirer access', relevance: 'Default for global enterprise brands in France' },
    { name: 'Lyf Pay',        type: 'Wallet + Aggregator', description: 'BNP/Crédit Mutuel/Auchan JV wallet', relevance: 'Top French QR + in-store wallet' },
  ],
  'Spain': [
    { name: 'Redsys',         type: 'National Switch + Gateway', description: 'Spanish bank-consortium card switch', relevance: 'Mandatory rail for Spanish card volume' },
    { name: 'CaixaBank Payments', type: 'Bank Acquirer',    description: 'CaixaBank merchant services (ex-Comercia)', relevance: '#1 Spanish bank-owned acquirer' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global PSP with Spanish acquirer access', relevance: 'Default for global enterprise brands in Spain' },
    { name: 'Stripe',         type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for Spanish SaaS / digital-native' },
    { name: 'Bizum',          type: 'Wallet + A2A',         description: 'Bank-consortium A2A wallet — 28M+ users', relevance: 'Dominant Spanish wallet; native acceptance everywhere' },
  ],
  'Netherlands': [
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global enterprise PSP HQ\'d in NL', relevance: 'Default for global brands; native iDEAL access' },
    { name: 'Mollie',         type: 'Aggregator + Gateway', description: 'Dutch SMB-favourite PSP', relevance: '#1 PSP for Dutch SMBs; deep iDEAL routing' },
    { name: 'Buckaroo',       type: 'Aggregator + Gateway', description: 'Dutch PSP with mid-market focus', relevance: 'Top alternative Dutch PSP with APM + invoice coverage' },
    { name: 'ING',            type: 'Bank Acquirer',        description: 'ING Netherlands merchant services', relevance: '#1 Dutch bank-owned acquirer' },
    { name: 'Worldline',      type: 'Acquirer + Gateway',  description: 'Top EU acquirer with mature Dutch network', relevance: 'Top alternative acquirer for Dutch volume' },
  ],
  'Italy': [
    { name: 'Nexi',           type: 'Acquirer + Gateway',  description: 'Italian-rooted top EU acquirer (PayTech / SIA / Nets merger)', relevance: '#1 Italian acquirer by merchant count' },
    { name: 'Worldline',      type: 'Acquirer + Gateway',  description: 'Top EU acquirer with strong Italian network', relevance: 'Top alternative acquirer for Italian volume' },
    { name: 'Satispay',       type: 'Wallet + A2A',         description: 'Italian-rooted A2A wallet', relevance: 'Top Italian-native wallet; widely accepted in-store + online' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global PSP with Italian acquirer access', relevance: 'Default for global enterprise brands in Italy' },
    { name: 'Stripe',         type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for Italian SaaS / digital-native' },
  ],
  'Poland': [
    { name: 'PayU',           type: 'Aggregator + Gateway', description: 'Top Polish PSP', relevance: '#1 PSP in Poland by merchant volume' },
    { name: 'Przelewy24',     type: 'A2A + Aggregator',    description: 'Top Polish A2A + APM aggregator (P24)', relevance: '#1 Polish alternative-payments rail' },
    { name: 'BLIK',           type: 'A2A Scheme',           description: 'Bank-consortium A2A scheme', relevance: 'Dominant Polish wallet — used by 15M+' },
    { name: 'eService',       type: 'Bank Acquirer',        description: 'PKO BP / Global Payments JV acquirer', relevance: '#1 Polish bank-owned acquirer' },
    { name: 'Tpay',           type: 'Aggregator + Gateway', description: 'Polish PSP focused on SMEs', relevance: 'Top SMB PSP in Poland' },
  ],
  'Sweden': [
    { name: 'Klarna',         type: 'BNPL + Wallet',        description: 'Swedish-rooted dominant Nordic BNPL', relevance: 'Default checkout option for Swedish consumers' },
    { name: 'Trustly',        type: 'A2A',                  description: 'Swedish A2A / pay-by-bank leader', relevance: '#1 Nordic A2A rail' },
    { name: 'Swish',          type: 'Wallet + A2A',         description: 'Bank-consortium real-time wallet', relevance: 'Dominant Swedish wallet — 8M+ users (~80% adults)' },
    { name: 'Adyen',          type: 'Aggregator + Gateway', description: 'Global PSP with Swedish acquirer access', relevance: 'Default for global enterprise brands in Sweden' },
    { name: 'Bambora',        type: 'Acquirer + Gateway',  description: 'Nordic-rooted acquirer (Worldline-owned)', relevance: 'Top Nordic acquirer for SMEs + mid-market' },
  ],

  // APAC
  'Japan': [
    { name: 'GMO Payment Gateway', type: 'Aggregator + Gateway', description: 'Top Japanese PSP', relevance: '#1 PSP in Japan by merchant count' },
    { name: 'SBPS',                type: 'Aggregator + Gateway', description: 'SoftBank Payment Service', relevance: 'Top Japanese PSP for enterprise merchants' },
    { name: 'SMBC',                type: 'Bank Acquirer',         description: 'Sumitomo Mitsui Card Co. acquirer', relevance: '#1 Japanese bank-owned acquirer' },
    { name: 'Mitsubishi UFJ NICOS', type: 'Bank Acquirer',        description: 'MUFG-owned card acquirer', relevance: 'Top-3 Japanese bank acquirer' },
    { name: 'Komoju',              type: 'Aggregator + Gateway', description: 'Japan-rooted PSP popular with global indie', relevance: 'Default PSP for cross-border digital-goods + gaming' },
  ],
  'South Korea': [
    { name: 'KG Inicis',     type: 'Aggregator + Gateway', description: 'Top legacy Korean PSP', relevance: '#1 PSP in Korea by enterprise merchant count' },
    { name: 'Toss Payments', type: 'Aggregator + Gateway', description: 'Viva Republica payment unit', relevance: 'Top Korean PSP for digital-native merchants' },
    { name: 'NHN KCP',       type: 'Aggregator + Gateway', description: 'NHN-owned Korean PSP', relevance: 'Top-3 Korean PSP by enterprise count' },
    { name: 'KakaoPay',      type: 'Wallet + Aggregator',  description: 'Kakao-owned dominant Korean wallet', relevance: 'Largest Korean wallet — 40M+ users' },
    { name: 'Naver Pay',     type: 'Wallet + Aggregator',  description: 'Naver-owned Korean wallet', relevance: 'Top-2 Korean wallet; native Smart Store payment' },
  ],
  'India': [
    { name: 'Razorpay',  type: 'Aggregator + Gateway', description: 'Indian-native PSP, UPI + RuPay native', relevance: '#1 Indian PSP for digital-natives + SMEs' },
    { name: 'BillDesk',  type: 'Aggregator + Gateway', description: 'PayU-owned Indian PSP', relevance: '#1 Indian PSP for enterprise + bill-pay volume' },
    { name: 'PayU India',type: 'Aggregator + Gateway', description: 'PayU\'s Indian arm', relevance: 'Top Indian PSP for marketplaces + enterprise' },
    { name: 'Cashfree',  type: 'Aggregator + Gateway', description: 'Indian PSP with PA-CB cross-border license', relevance: 'Strong for cross-border + payouts in India' },
    { name: 'CCAvenue',  type: 'Aggregator + Gateway', description: 'Infibeam-owned legacy Indian gateway', relevance: 'Incumbent PSP for large Indian merchants' },
  ],
  'Indonesia': [
    { name: 'Midtrans',  type: 'Aggregator + Gateway', description: 'GoTo-owned Indonesian PSP', relevance: '#1 PSP for enterprise + marketplace merchants' },
    { name: 'Xendit',    type: 'Aggregator + Gateway', description: 'Indonesia-HQ\'d SEA PSP', relevance: 'Top Indonesian PSP for digital-natives + SMEs' },
    { name: 'DOKU',      type: 'Aggregator + Gateway', description: 'Pioneer Indonesian PSP', relevance: 'Long-standing top-3 PSP for legacy enterprises' },
    { name: 'iPay88',    type: 'Aggregator + Gateway', description: 'SEA PSP with Indonesia coverage', relevance: 'Top SEA PSP with Indonesian acquiring' },
    { name: 'Faspay',    type: 'Aggregator + Gateway', description: 'Indonesian PSP with strong VA + e-wallet coverage', relevance: 'Top alternative Indonesian PSP for mid-market' },
  ],
  'Singapore': [
    { name: 'Stripe',     type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for Singaporean digital-native merchants' },
    { name: 'Adyen',      type: 'Aggregator + Gateway', description: 'Global PSP with Singapore APAC HQ', relevance: 'Default for global enterprise brands in APAC' },
    { name: 'NETS',       type: 'National Scheme + A2A', description: 'Bank-consortium-run national debit + QR scheme', relevance: 'Dominant Singaporean local scheme; native QR + PayNow' },
    { name: '2C2P',       type: 'Aggregator + Gateway', description: 'SEA-focused PSP HQ\'d in Singapore', relevance: '#1 SEA PSP with deep APAC APM coverage' },
    { name: 'GrabPay',    type: 'Wallet',                description: 'Grab-owned super-app wallet', relevance: 'Top Southeast Asian wallet; widely accepted in SG' },
  ],
  'Australia': [
    { name: 'Tyro',         type: 'Acquirer + POS',      description: 'Australian SMB-focused acquirer (ASX-listed)', relevance: '#1 Australian SMB acquirer by merchant count' },
    { name: 'Adyen',        type: 'Aggregator + Gateway', description: 'Global PSP with Australian acquirer access', relevance: 'Default for global enterprise brands in Australia' },
    { name: 'Stripe',       type: 'Aggregator + Gateway', description: 'Developer-first PSP', relevance: '#1 PSP for Australian digital-native merchants' },
    { name: 'Eway',         type: 'Aggregator + Gateway', description: 'Australian-rooted PSP (Global Payments-owned)', relevance: 'Top legacy Australian PSP for SMEs' },
    { name: 'Square',       type: 'SMB Acquirer + POS',   description: 'Block-owned (ex-Afterpay parent) SMB acquirer', relevance: 'Top Australian SMB acquirer + Afterpay BNPL native' },
  ],
  'Philippines': [
    { name: 'GCash',      type: 'Wallet + Acquirer',     description: 'Globe Telecom/Ant-owned super-app wallet', relevance: '#1 Filipino wallet — 80M+ users' },
    { name: 'Maya Business', type: 'Wallet + Acquirer',  description: 'PLDT/Voyager-owned PSP + wallet', relevance: '#2 Filipino wallet — 50M+ users; native acquirer' },
    { name: 'PayMongo',   type: 'Aggregator + Gateway',  description: 'Filipino-native PSP', relevance: 'Top Filipino PSP for digital-native merchants' },
    { name: 'Dragonpay',  type: 'A2A + Cash voucher',    description: 'Filipino A2A + cash-pay legacy PSP', relevance: '#1 Filipino A2A + over-the-counter cash rail' },
    { name: '2C2P',       type: 'Aggregator + Gateway',  description: 'SEA-focused PSP', relevance: 'Top SEA PSP with deep Filipino APM coverage' },
  ],
  'Thailand': [
    { name: '2C2P',         type: 'Aggregator + Gateway', description: 'SEA-focused PSP HQ\'d in Bangkok', relevance: '#1 Thai PSP for enterprise + cross-border' },
    { name: 'Opn Payments', type: 'Aggregator + Gateway', description: 'Thai-Japanese PSP (ex-Omise)', relevance: 'Top Thai PSP for digital-native merchants' },
    { name: 'KBank',        type: 'Bank Acquirer',         description: 'Kasikornbank K-Payment Gateway', relevance: '#1 Thai bank-owned acquirer' },
    { name: 'SCB',          type: 'Bank Acquirer',         description: 'Siam Commercial Bank payment services', relevance: 'Top-2 Thai bank-owned acquirer' },
    { name: 'TrueMoney',    type: 'Wallet + A2A',          description: 'Ant-backed Thai super-app wallet', relevance: 'Dominant Thai wallet — 30M+ users' },
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
