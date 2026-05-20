// Provider â†’ logo URL map. Logos render in the SlideCountryConnections
// "Most Relevant" column. Two-tier lookup:
//   1. Local file under /public/company-logos/ or /public/logos/providers/
//      (preferred â€” no external dependency, no rate limit).
//   2. Clearbit Logo API by company domain
//      (https://logo.clearbit.com/<domain>?size=128) as fallback.
// When both fail, the slide renders the provider's name as a styled
// wordmark instead.

// Local logo assets. PSP-tagged files in /public/logos/psp/ are the
// curated brand-kit versions (Yuno-approved alt-text, high-res, alpha
// channel suitable for the white-silhouette filter). Older files in
// /company-logos/ and /logos/providers/ stay as backstops for marks
// the brand kit doesn't ship yet.
const LOCAL_LOGO = {
  Adyen: '/connections-deck/logos/psp/psp_adyen.png',
  Stripe: '/connections-deck/logos/psp/psp_stripe.png',
  Fiserv: '/connections-deck/logos/psp/psp_fiserv.png',
  'Mercado Pago': '/connections-deck/logos/psp/psp_mercadopago.png',
  PayPal: '/connections-deck/logos/psp/psp_paypal.png',
  Worldpay: '/connections-deck/logos/psp/psp_worldpay.png',
  // Brand kit only ships JPG for Checkout.com (no alpha, breaks the
  // silhouette filter), so keep the legacy PNG from /company-logos/.
  'Checkout.com': '/connections-deck/company-logos/checkout.png',
  dLocal: '/connections-deck/company-logos/dlocal.png',
  Nuvei: '/connections-deck/company-logos/nuvei.png',
  Worldline: '/connections-deck/company-logos/worldline.png',
  Prosa: '/connections-deck/logos/providers/prosa.png',
  Izipay: '/connections-deck/logos/providers/izipay.png',
  Trustly: '/connections-deck/logos/providers/trustly.png',
  Redeban: '/connections-deck/logos/providers/redeban.png',
  Visanet: '/connections-deck/logos/providers/visanet.png',
}

// Public web domain per provider for Clearbit Logo API lookup. Limited
// to providers we curated rows for in country-rich-data.js.
const PROVIDER_DOMAIN = {
  // Global PSPs
  'Adyen': 'adyen.com',
  'Stripe': 'stripe.com',
  'Checkout.com': 'checkout.com',
  'Cybersource': 'cybersource.com',
  'Fiserv': 'fiserv.com',
  'Global Payments': 'globalpayments.com',
  'EVO Payments': 'evopayments.com',
  'EVO Cards': 'evopayments.com',
  'ACI Worldwide': 'aciworldwide.com',
  'Ecommpay': 'ecommpay.com',

  // MENAT
  'HyperPay': 'hyperpay.com',
  'Paymob': 'paymob.com',
  'Moyasar': 'moyasar.com',
  'Telr': 'telr.com',
  'Tap': 'tap.company',
  'PayTabs': 'paytabs.com',
  'BenefitPay': 'benefit.bh',
  'MyFatoorah': 'myfatoorah.com',
  'Network International': 'network.ae',
  'Fawry': 'fawry.com',
  'CMI': 'cmi.co.ma',
  'Naps': 'naps.ma',
  'iyzico': 'iyzico.com',
  'PayTR': 'paytr.com',
  'Param': 'param.com.tr',
  'BKM Express': 'bkmexpress.com.tr',
  'Sipay': 'sipay.com.tr',
  'QNB': 'qnb.com',
  'NEC Payment Services': 'nec-payments.com',

  // LATAM
  'Cielo': 'cielo.com.br',
  'Rede': 'userede.com.br',
  'PagSeguro': 'pagseguro.uol.com.br',
  'Mercado Pago': 'mercadopago.com',
  'EBANX': 'ebanx.com',
  'PicPay': 'picpay.com',
  'ItaÃº': 'itau.com.br',
  'Vindi': 'vindi.com.br',
  'PayU': 'payu.com',
  'Wompi': 'wompi.co',
  'Bamboo': 'bamboopaymentsystems.com',
  'Fintoc': 'fintoc.com',
  'dLocal': 'dlocal.com',
  'Powerpay': 'powerpay.pe',
  'Izipay': 'izipay.pe',

  // Mexico
  'Prosa': 'prosa.com.mx',
  'BBVA Openpay': 'openpay.mx',
  'Afirme': 'afirme.com',
  'ARCUS': 'arcusfi.com',

  // APAC
  'Airwallex': 'airwallex.com',
  'Do Payment': 'dopayments.com',
  'Razorpay': 'razorpay.com',
  'Xendit': 'xendit.co',
  '2C2P': '2c2p.com',
}

const CLEARBIT_BASE = 'https://logo.clearbit.com'
const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons'
const DDG_ICON_BASE = 'https://icons.duckduckgo.com/ip3'

// Returns an ordered list of logo URL candidates for a provider. The
// rendering component walks the chain with onError and falls back to the
// brand-colour wordmark pill when every source fails.
//
// Strategy: prefer local white-silhouette assets (consistent rendering,
// no external dependency), then Clearbit (global brands), then drop the
// favicon paths â€” favicons at table scale rendered as tiny illegible
// blobs in QA, so the wordmark pill is the cleaner fallback.
export function getProviderLogoSources(name) {
  if (!name) return []
  const sources = []
  if (LOCAL_LOGO[name]) sources.push({ url: LOCAL_LOGO[name], isLocal: true })
  const domain = PROVIDER_DOMAIN[name]
  if (domain) sources.push({ url: `${CLEARBIT_BASE}/${domain}?size=200`, isLocal: false })
  return sources
}

// Brand colour by provider for the wordmark fallback. Picks up the
// canonical brand hue so the cell still feels like a brand mark rather
// than generic text. Falls back to the deck's accent pale on unknown
// providers.
export const PROVIDER_BRAND_COLOR = {
  'Adyen': '#0ABF53',
  'Stripe': '#635BFF',
  'Checkout.com': '#0073FF',
  'Cybersource': '#1A1F71',
  'Fiserv': '#FF6600',
  'Global Payments': '#003C71',
  'Worldpay': '#E2231A',
  'Nuvei': '#0F1B61',
  'Worldline': '#1C2D5A',
  'ACI Worldwide': '#0066CC',
  'Ecommpay': '#3F51B5',
  // MENAT
  'HyperPay': '#0067B2',
  'Paymob': '#1A6BFF',
  'Moyasar': '#54B948',
  'Telr': '#8BC34A',
  'Tap': '#5E48E8',
  'PayTabs': '#0090D9',
  'BenefitPay': '#E62E2D',
  'MyFatoorah': '#0093D0',
  'Network International': '#7A3E98',
  'Fawry': '#FFC300',
  'CMI': '#003DA5',
  'Naps': '#1F4E79',
  'iyzico': '#1FCC9D',
  'PayTR': '#FF6600',
  'Param': '#0091EA',
  'BKM Express': '#E30613',
  'Sipay': '#F5821F',
  'QNB': '#7B1F1F',
  // LATAM
  'Cielo': '#0066CC',
  'Rede': '#FF6900',
  'PagSeguro': '#FFC107',
  'Mercado Pago': '#00B1EA',
  'EBANX': '#1F4FFF',
  'PicPay': '#21C25E',
  'ItaÃº': '#EC7000',
  'Vindi': '#FF7A00',
  'PayU': '#A6CE39',
  'Wompi': '#FFDC00',
  'Bamboo': '#FF6F00',
  'Fintoc': '#00CC88',
  'dLocal': '#08A36A',
  'Powerpay': '#FF5C00',
  'Izipay': '#00A8E1',
  // Mexico
  'Prosa': '#003DA5',
  'BBVA Openpay': '#004481',
  'Afirme': '#E30613',
  'ARCUS': '#0066CC',
  // APAC
  'Airwallex': '#612FFF',
  'Razorpay': '#0C2451',
  'Xendit': '#5046E5',
  '2C2P': '#1B3F8F',
  'Do Payment': '#00A4E4',
}

export function getProviderBrandColor(name) {
  return PROVIDER_BRAND_COLOR[name] || null
}

// Legacy single-URL accessor kept for any callers that haven't migrated
// to the multi-source chain. New code should use getProviderLogoSources.
export function getProviderLogo(name) {
  const sources = getProviderLogoSources(name)
  return sources[0]?.url || null
}

// Payment-method â†’ local logo path. Used by SlideRegionPMsMap to render
// each country's Local Scheme / Local A2A / APM row as a real brand
// mark instead of plain text. Files live in /public/logos/pm/ and are
// the curated Yuno brand-kit assets (PNG with alpha so the
// white-silhouette filter applies cleanly).
const PM_LOGO = {
  // Local schemes
  'JCB': null,
  'Carnet': null,
  // Local A2A
  'Pix': '/connections-deck/logos/pm/pm_pix.png',
  'UPI': '/connections-deck/logos/pm/pm_upi.png',
  'QRIS': '/connections-deck/logos/pm/pm_qris.svg',
  'PayNow': '/connections-deck/logos/pm/pm_paynow.png',
  'PromptPay': '/connections-deck/logos/pm/pm_promptpay.png',
  'Bizum': '/connections-deck/logos/pm/pm_bizum.png',
  // APMs / wallets
  'Klarna': '/connections-deck/logos/pm/pm_klarna.png',
  'GCash': '/connections-deck/logos/pm/pm_gcash.png',
  'GrabPay': '/connections-deck/logos/pm/pm_grabpay.png',
  'OVO': '/connections-deck/logos/pm/pm_ovo.png',
  'Dana': '/connections-deck/logos/pm/pm_dana.png',
  'ShopeePay': '/connections-deck/logos/pm/pm_shopeepay.png',
  'KakaoPay': '/connections-deck/logos/pm/pm_kakaopay.png',
  'Naver Pay': '/connections-deck/logos/pm/pm_naverpay.png',
  'Paytm': '/connections-deck/logos/pm/pm_paytm.png',
  'PayPal': '/connections-deck/logos/pm/pm_paypal.png',
  'Apple Pay': '/connections-deck/logos/pm/pm_applepay.png',
  'Google Pay': '/connections-deck/logos/pm/pm_googlepay.png',
  'Maya': '/connections-deck/logos/pm/pm_maya.png',
  'TrueMoney': '/connections-deck/logos/pm/pm_truemoney.png',
  'Rabbit LINE Pay': '/connections-deck/logos/pm/pm_rabbitline.png',
  'Alipay': '/connections-deck/logos/pm/pm_alipay.png',
  'OXXO Pay': null,    // brand kit JPG only, breaks silhouette filter
  'Swish': '/connections-deck/logos/pm/pm_swish.svg',
  'MB Way': '/connections-deck/logos/pm/pm_mbway.png',
  'TWINT': '/connections-deck/logos/pm/pm_twint.png',
  "Touch'n Go": '/connections-deck/logos/pm/pm_touchngo.svg',
  'MoMo': '/connections-deck/logos/pm/pm_momo.png',
  'Easypaisa': '/connections-deck/logos/pm/pm_easypaisa.png',
  'bKash': '/connections-deck/logos/pm/pm_bkash.png',
  'Cash App': '/connections-deck/logos/pm/pm_cashapp.png',
  // Card schemes
  'Mastercard': '/connections-deck/logos/pm/pm_mastercard.svg',
  'Visa': '/connections-deck/logos/pm/pm_visa.png',
  'Amex': '/connections-deck/logos/pm/pm_amex.png',
  'American Express': '/connections-deck/logos/pm/pm_amex.png',
  'Discover': '/connections-deck/logos/pm/pm_discover.png',
  // Reuse PSP-shape brand marks where a logo also doubles as a PM/APM
  // (Mercado Pago = wallet in Argentina, GCash etc. already covered above).
  'Mercado Pago': '/connections-deck/logos/psp/psp_mercadopago.png',
}

export function getPmLogo(name) {
  if (!name) return null
  // Direct match first, then case-insensitive scan as a courtesy.
  if (PM_LOGO[name]) return PM_LOGO[name]
  const lower = name.toLowerCase()
  for (const key of Object.keys(PM_LOGO)) {
    if (key.toLowerCase() === lower && PM_LOGO[key]) return PM_LOGO[key]
  }
  return null
}
