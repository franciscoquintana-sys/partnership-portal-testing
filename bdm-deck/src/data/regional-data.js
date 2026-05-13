// Per-country market + Yuno coverage data, region-grouped. Sourced
// from the Yuno Global Market Insights 2026 deck set + the Research
// Content by Country markdown. Used by SlideRegionOverview,
// SlideCountryOverview, and SlideCountryConnections.
//
// Shape per country:
//   { country, paymentMethods[], verticals[], digitalTrends[],
//     processors[], paymentMethodsCovered[] }
//
// processors is empty when Yuno has no current coverage in that
// country, the connections slide renders an explicit "verify
// coverage" callout instead of an empty table.

export const REGIONAL_DATA = {
  "Americas": [
    {
      "country": "United States",
      "paymentMethods": [
        "Digital Wallets: ~32% (PayPal ~22%, Apple Pay, Google Pay)",
        "Credit/Debit Cards: ~30% (Visa, Mastercard, Amex)",
        "BNPL: ~9% (Affirm, Klarna, Afterpay)",
        "Bank Transfers / ACH: ~3%",
        "Prepaid/Gift Cards: ~3%"
      ],
      "verticals": [
        "Electronics & Technology",
        "Fashion & Apparel",
        "Health & Beauty",
        "Groceries & Food Delivery",
        "Home & Furniture"
      ],
      "digitalTrends": [
        "E-commerce market: ~$1.2T (2024), projected ~$1.8–2.0T by 2029",
        "Smartphone penetration: ~92%",
        "Internet penetration: ~97%",
        "CAGR: ~10–11% (2024–2029)",
        "State-level data privacy laws expanding (CCPA model); FTC increasing scrutiny on subscription billing"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "Cybersource",
        "Fiserv",
        "Stripe",
        "Global Payments",
        "EVO Payments"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay",
        "PayPal",
        "Visa Click to Pay",
        "Mastercard Payment Passkey"
      ]
    },
    {
      "country": "Canada",
      "paymentMethods": [
        "Credit Cards: ~40% (Visa, Mastercard dominant)",
        "Digital Wallets: ~22% (PayPal, Apple Pay, Google Pay)",
        "Debit / Interac Online: ~15%",
        "BNPL: ~7% (Afterpay, Klarna, Affirm)",
        "Bank Transfers: ~5%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Media",
        "Groceries & Food Delivery",
        "Health & Beauty",
        "Furniture & Home"
      ],
      "digitalTrends": [
        "E-commerce market: ~CAD $75–80B (2024), projected ~CAD $120–130B by 2029",
        "Smartphone penetration: ~90%",
        "Internet penetration: ~97%",
        "CAGR: ~10–12% (2024–2029)",
        "Digital Charter Implementation Act (Bill C-27) advancing new privacy protections; ~60% of Canadians buy from US merchants"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "Cybersource",
        "Fiserv",
        "Stripe",
        "Global Payments"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Interac",
        "Apple Pay",
        "Google Pay",
        "PayPal"
      ]
    },
    {
      "country": "Mexico",
      "paymentMethods": [
        "Credit/Debit Cards: ~48–70% (Visa + Mastercard = 99% of card market)",
        "OXXO Pay: ~15% (cash voucher at 22,000+ stores, 50% of all voucher-based digital transactions)",
        "SPEI: ~21% (instant bank transfers; 5.34B transfers in 2024)",
        "Digital Wallets: ~21% (Spin by OXXO: 13M+ users; Mercado Pago)",
        "BNPL: emerging (Kueski Pay, Aplazo)",
        "COD: ~3%"
      ],
      "verticals": [
        "Retail",
        "Fashion, Health & Beauty",
        "Food Delivery",
        "Travel & Hospitality",
        "Consumer Electronics"
      ],
      "digitalTrends": [
        "E-commerce market: $97B (2024, #2 in LATAM), projected $184B by 2027, CAGR ~24%",
        "Mobile drives 78.5% of purchases; 97.2% of internet connections are mobile",
        "Internet penetration: 83.2% (107.3M users)",
        "Fastest-growing e-commerce country globally in 2024 (+20% YoY)",
        "Ley Fintech shaping digital payments; ~45% unbanked driving APM innovation"
      ],
      "processors": [
        "Prosa",
        "Afirme",
        "EVO Cards",
        "ARCUS",
        "BBVA",
        "dLocal",
        "EBANX"
      ],
      "paymentMethodsCovered": [
        "OXXO Pay",
        "SPEI",
        "CoDi (QR)",
        "Credit/Debit cards"
      ]
    }
  ],
  "LATAM": [
    {
      "country": "Brazil",
      "paymentMethods": [
        "Pix: 42% (projected 51% by 2027), 63.4B transactions worth $4.6T in 2024 (+53% YoY)",
        "Credit Cards: 41% (installment \"parcelado\" very popular)",
        "Boleto Bancario: 19% (cash voucher for unbanked)",
        "Digital Wallets: 9% (Mercado Pago leads at 40% wallet share, +20% YoY)",
        "BNPL: emerging via fintechs"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Food & Beverages",
        "Electronics & Technology",
        "Travel & Hospitality",
        "Health & Beauty"
      ],
      "digitalTrends": [
        "E-commerce market: $346B (2024), projected $586B by 2027, CAGR ~19%",
        "Smartphone penetration: ~97% (217M mobile connections)",
        "Internet penetration: 86.6%",
        "Mobile commerce drives 53.7% of transaction value",
        "Pix transforming entire payment infrastructure"
      ],
      "processors": [
        "Cielo",
        "Rede",
        "PagSeguro",
        "Mercado Pago",
        "EBANX",
        "PicPay",
        "Itau",
        "Vindi"
      ],
      "paymentMethodsCovered": [
        "PIX (via Itau",
        "PicPay)",
        "Boleto (via Mercado Pago)",
        "Credit/Debit cards",
        "Alelo",
        "Veloe"
      ]
    },
    {
      "country": "Colombia",
      "paymentMethods": [
        "PSE (Pagos Seguros en Linea): ~32–63% (dominant bank transfer, 370M+ transactions Q1 2024)",
        "Credit Cards: 37% (Visa, Mastercard, Amex)",
        "Nequi: #1 digital wallet, 54% of Colombians use it",
        "Daviplata: 22% adoption, second-largest wallet",
        "Debit Cards: 64% of Colombians have one",
        "Cash/Efecty: still relevant for underbanked"
      ],
      "verticals": [
        "Retail/Marketplaces",
        "Travel & Hospitality",
        "Food Delivery",
        "Technology & Electronics",
        "Fashion & Beauty"
      ],
      "digitalTrends": [
        "E-commerce market: $52B (2024), projected $81B by 2027, CAGR ~16%",
        "87% of e-commerce from mobile",
        "Internet penetration: ~73%",
        "Digital wallet transfers grew 231% in H2 2024 vs. prior year",
        "88% of adults already make online purchases"
      ],
      "processors": [
        "PayU",
        "Wompi",
        "Bamboo"
      ],
      "paymentMethodsCovered": [
        "PSE (via Bamboo)",
        "Efecty",
        "Pago Facil (via Wompi)",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Chile",
      "paymentMethods": [
        "Credit Cards: ~60% (Redcompra 44%, Mastercard 29%, Visa 27%)",
        "Digital Wallets: 34% (MACH, Mercado Pago, growing at 16.6% CAGR)",
        "Debit Cards: ~20%",
        "Webpay (bank transfers): 74% of bank transfer market",
        "Khipu: 16% of transfer market"
      ],
      "verticals": [
        "Clothing & Shoes",
        "Consumer Electronics",
        "Food & Beverages",
        "Cosmetics & Health",
        "Home & Appliances"
      ],
      "digitalTrends": [
        "E-commerce market: $35B (2024), projected $46B by 2027, CAGR ~9–11%",
        "66% of transactions via mobile",
        "Internet penetration: 88.3%, highest in LATAM, rapid 5G deployment",
        "Most digitally mature market in Latin America",
        "Credit cards expected to remain dominant at 61% through 2027"
      ],
      "processors": [
        "Fintoc (account-to-account)"
      ],
      "paymentMethodsCovered": [
        "A2A transfers",
        "Credit/Debit cards",
        "Mastercard Payment Passkey"
      ]
    },
    {
      "country": "Argentina",
      "paymentMethods": [
        "Digital Wallets: 46% (#1 method), MODO 31.6%, Uala 20.6%, Cuenta DNI 14.4%, BNA+ 12.2%",
        "Mercado Pago: dominant wallet ecosystem",
        "Credit Cards: 39% (Visa leads with 60%+ of card payments)",
        "Bank Transfers: growing via MODO interoperable network",
        "BNPL: projected $6.19B market by 2030"
      ],
      "verticals": [
        "Food & Beverages",
        "Tools & Construction Materials",
        "Electronics & Technology",
        "Travel & Hospitality",
        "Fashion & Apparel"
      ],
      "digitalTrends": [
        "E-commerce market: $33B (2024), CAGR ~17% through 2027",
        "71% of e-commerce via mobile",
        "Internet penetration: ~87%, projected 98% by 2029",
        "Fastest-growing e-commerce in LATAM in 2024 (+29% YoY)",
        "Digital wallets projected to reach 59% share by 2027"
      ],
      "processors": [
        "Mercado Pago",
        "dLocal"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Mastercard Payment Passkey"
      ]
    },
    {
      "country": "Peru",
      "paymentMethods": [
        "Credit Cards: ~42% (declining from 56% in 2019)",
        "Yape (BCP wallet): #1 wallet, 50% of wallet volume, ~14M users",
        "PagoEfectivo: 19% (cash voucher, $4.75B volume)",
        "PLIN (interbank wallet): ~14M users, growing",
        "Debit Cards: declining as wallets grow",
        "Bank Transfers: smaller but growing"
      ],
      "verticals": [
        "Electronics & Media",
        "Food & Personal Care",
        "Furniture & Appliances",
        "Fashion",
        "Travel & Tourism"
      ],
      "digitalTrends": [
        "E-commerce market: $37B (2024), CAGR ~17% through 2027",
        "74% of e-commerce from mobile",
        "Internet penetration: ~76% (rising fast from 58% in 2019)",
        "Yape + digital wallets projected to capture 28–31% of all payments by 2027",
        "Lowest internet penetration of the 6 LATAM countries but fastest digital adoption curve"
      ],
      "processors": [
        "PayU",
        "Powerpay"
      ],
      "paymentMethodsCovered": [
        "BNPL via Powerpay",
        "Credit/Debit cards"
      ]
    }
  ],
  "APAC": [
    {
      "country": "Japan",
      "paymentMethods": [
        "Credit Cards: ~60–65% (Visa, JCB, Mastercard)",
        "Konbini (convenience store): ~10%",
        "PayPay (QR code): ~8–10%, fastest growing",
        "Bank transfer (Furikomi): ~7%",
        "Carrier billing (d-barai, au PAY): ~5%",
        "LINE Pay / Rakuten Pay: ~3–4%"
      ],
      "verticals": [
        "Electronics & Appliances",
        "Fashion & Apparel",
        "Food & Grocery Delivery",
        "Digital Content & Gaming",
        "Health & Beauty"
      ],
      "digitalTrends": [
        "E-commerce market: ~$200B (2024), projected $230B+ by 2026",
        "Smartphone penetration: ~85%",
        "Internet penetration: ~93%",
        "Government targeting 40% cashless ratio by 2025 (was ~39% in 2024); QR payments surging",
        "CAGR: ~8–10% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "Airwallex",
        "Do Payment"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "PayPay",
        "LINE Pay",
        "Konbini",
        "Apple Pay",
        "Google Pay"
      ]
    },
    {
      "country": "South Korea",
      "paymentMethods": [
        "Credit/Debit Cards: ~55–60% (Samsung Card, Shinhan, Hyundai)",
        "KakaoPay: ~15–18%",
        "Naver Pay: ~10–12%",
        "Samsung Pay: ~5–7%",
        "Toss (bank transfer): ~5%",
        "Virtual account/convenience store: ~3%"
      ],
      "verticals": [
        "Fashion & Beauty",
        "Food Delivery & Grocery",
        "Electronics & Gadgets",
        "Travel & Entertainment",
        "Social/Live Commerce"
      ],
      "digitalTrends": [
        "E-commerce market: ~$170–180B (2024), top 5 globally",
        "Smartphone penetration: ~97% (highest globally)",
        "Internet penetration: ~98%",
        "Coupang dominates ~25% market share; quick-commerce is standard",
        "CAGR: ~7–9% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "Airwallex"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "KakaoPay",
        "Naver Pay",
        "Samsung Pay"
      ]
    },
    {
      "country": "India",
      "paymentMethods": [
        "UPI (Google Pay, PhonePe, Paytm): ~45–50% of digital payments",
        "Credit/Debit Cards: ~15–18%",
        "Cash on Delivery: ~15–20% (declining)",
        "Net Banking: ~8–10%",
        "Mobile Wallets (Paytm Wallet, Amazon Pay): ~5%",
        "BNPL (Simpl, LazyPay): ~3–4%, fast growing"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Mobile Phones",
        "Quick Commerce",
        "Beauty & Personal Care",
        "Pharmacy & Health"
      ],
      "digitalTrends": [
        "E-commerce market: ~$80–90B (2024), projected $150B+ by 2027",
        "Smartphone penetration: ~71% (~850M users)",
        "Internet penetration: ~52–55% (~780M users)",
        "UPI: 14B+ transactions/month; RBI pushing digital payments interoperability",
        "CAGR: ~18–22% (2024–2028), fastest in APAC"
      ],
      "processors": [
        "Airwallex",
        "Do Payment",
        "regional providers"
      ],
      "paymentMethodsCovered": [
        "UPI",
        "Paytm",
        "Credit/Debit cards",
        "Alipay (cross-border)"
      ]
    },
    {
      "country": "Indonesia",
      "paymentMethods": [
        "E-wallets: ~35–40% (GoPay, OVO, Dana, ShopeePay)",
        "Bank Transfer (virtual account): ~25–30%",
        "Credit/Debit Cards: ~10–12%",
        "Convenience Store (Alfamart, Indomaret): ~8%",
        "COD: ~8–10%",
        "QRIS (national QR standard): ~5%, rapidly growing"
      ],
      "verticals": [
        "Fashion & Muslim Fashion",
        "Beauty & Personal Care",
        "Electronics & Mobile Accessories",
        "Food & Grocery",
        "Social Commerce"
      ],
      "digitalTrends": [
        "E-commerce market: ~$65–70B (2024), largest in Southeast Asia",
        "Smartphone penetration: ~74%",
        "Internet penetration: ~79% (~220M users)",
        "TikTok Shop ban reversed via Tokopedia partnership; social commerce surging",
        "CAGR: ~15–17% (2024–2028)"
      ],
      "processors": [
        "Airwallex",
        "Do Payment",
        "regional providers"
      ],
      "paymentMethodsCovered": [
        "GoPay",
        "OVO",
        "Dana",
        "GrabPay",
        "QRIS",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Singapore",
      "paymentMethods": [
        "Credit/Debit Cards: ~45–50% (Visa, Mastercard)",
        "PayNow (bank-to-bank): ~12–15%",
        "GrabPay: ~8–10%",
        "Apple Pay / Google Pay: ~7–8%",
        "BNPL (Atome, Pace): ~5–6%",
        "Bank Transfer: ~5%"
      ],
      "verticals": [
        "Electronics & Gadgets",
        "Fashion & Luxury Goods",
        "Food Delivery & Grocery",
        "Travel & Experiences",
        "Health & Wellness"
      ],
      "digitalTrends": [
        "E-commerce market: ~$9–10B (2024)",
        "Smartphone penetration: ~92%",
        "Internet penetration: ~96%",
        "Cross-border e-commerce hub; PayNow-NPP linkage with Australia; regional QR interoperability",
        "CAGR: ~10–12% (2024–2028)"
      ],
      "processors": [
        "Airwallex",
        "Do Payment",
        "70+ regional providers"
      ],
      "paymentMethodsCovered": [
        "GrabPay",
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay",
        "PayNow"
      ]
    },
    {
      "country": "Australia",
      "paymentMethods": [
        "Credit/Debit Cards: ~50–55% (Visa, Mastercard)",
        "PayPal: ~15–18%",
        "Apple Pay / Google Pay: ~8–10%",
        "BNPL (Afterpay, Zip): ~10–12%",
        "Bank Transfer (PayTo/NPP): ~5%",
        "POLi Payments: ~2–3%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Home Appliances",
        "Food & Grocery",
        "Health, Beauty & Supplements",
        "Home & Garden"
      ],
      "digitalTrends": [
        "E-commerce market: ~$50–55B AUD (~$32–35B USD, 2024)",
        "Smartphone penetration: ~91%",
        "Internet penetration: ~96%",
        "BNPL regulation incoming (Treasury consultation 2024–25); Afterpay dominant but facing credit regulation",
        "CAGR: ~8–10% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "Airwallex"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay",
        "PayPal",
        "Afterpay"
      ]
    },
    {
      "country": "Philippines",
      "paymentMethods": [
        "E-wallets: ~35–40% (GCash: ~55M users, Maya/PayMaya)",
        "Cash on Delivery: ~20–25%",
        "Credit/Debit Cards: ~10–12%",
        "Bank Transfer (InstaPay, PESONet): ~10%",
        "GrabPay: ~5%",
        "Over-the-counter (7-Eleven, bayad centers): ~5–8%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Beauty & Personal Care",
        "Electronics & Mobile Phones",
        "Food Delivery",
        "Digital Goods & Gaming Credits"
      ],
      "digitalTrends": [
        "E-commerce market: ~$18–20B (2024)",
        "Smartphone penetration: ~72%",
        "Internet penetration: ~73% (~85M users)",
        "BSP targeting 50% digital payments by 2025; GCash dominant super-app; QR Ph expanding",
        "CAGR: ~15–18% (2024–2028)"
      ],
      "processors": [
        "Airwallex",
        "Do Payment"
      ],
      "paymentMethodsCovered": [
        "GCash",
        "GrabPay",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Thailand",
      "paymentMethods": [
        "Bank Transfer / PromptPay (national QR): ~35–40%",
        "Credit/Debit Cards: ~20–25%",
        "COD: ~12–15%",
        "E-wallets (TrueMoney, Rabbit LINE Pay): ~12–15%",
        "Mobile Banking Apps: ~8–10%",
        "Counter Payment (7-Eleven): ~5%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Beauty & Cosmetics",
        "Electronics & Gadgets",
        "Food Delivery & Grocery",
        "Health & Wellness"
      ],
      "digitalTrends": [
        "E-commerce market: ~$25–28B (2024)",
        "Smartphone penetration: ~78%",
        "Internet penetration: ~88% (~63M users)",
        "Government digital wallet scheme (10,000 baht stimulus) accelerating cashless adoption",
        "PromptPay interlinked with Singapore PayNow and Malaysia DuitNow",
        "CAGR: ~12–15% (2024–2028)"
      ],
      "processors": [
        "Airwallex",
        "Do Payment"
      ],
      "paymentMethodsCovered": [
        "PromptPay",
        "TrueMoney",
        "Rabbit LINE Pay",
        "Credit/Debit cards"
      ]
    }
  ],
  "Europe": [
    {
      "country": "United Kingdom",
      "paymentMethods": [
        "Credit/Debit Cards: ~40–42% (Visa, Mastercard)",
        "Digital Wallets: ~30–32% (PayPal, Apple Pay, Google Pay)",
        "Open Banking / Pay by Bank: ~5–6% (fastest growing)",
        "BNPL (Klarna, Clearpay): ~5–7%",
        "Bank Transfers: ~4%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Technology",
        "Grocery & Food Delivery",
        "Health & Beauty",
        "Home & Garden"
      ],
      "digitalTrends": [
        "E-commerce market: ~GBP 260–270B (2025), largest in Europe",
        "Smartphone penetration: ~92–93%",
        "Internet penetration: ~97%",
        "Open Banking leads Europe with 10M+ users; FCA enforcing SCA",
        "CAGR: ~8–9% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay",
        "PayPal",
        "Open Banking",
        "Klarna"
      ]
    },
    {
      "country": "Germany",
      "paymentMethods": [
        "PayPal: ~28–30% (dominant)",
        "Invoice / Kauf auf Rechnung: ~18–20%",
        "Credit/Debit Cards: ~14–16% (Visa, Mastercard, girocard)",
        "Sofort (Klarna-owned instant transfer): ~8–10%",
        "Klarna (BNPL): ~7–8%",
        "giropay: ~5–6%",
        "Direct Debit (Lastschrift): ~5%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Media",
        "Furniture & Home Living",
        "Food & Personal Care",
        "DIY & Garden"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 90–95B (2025), second largest in Europe",
        "Smartphone penetration: ~88–90%",
        "Internet penetration: ~95%",
        "Historically cash-preferring but COVID accelerated digital shift; PSD2/SCA fully enforced",
        "CAGR: ~7–8% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "SEPA",
        "Sofort",
        "Klarna",
        "giropay",
        "Credit/Debit cards",
        "PayPal"
      ]
    },
    {
      "country": "France",
      "paymentMethods": [
        "Carte Bancaire (CB): ~40–42% (national card scheme, dominant)",
        "PayPal: ~18–20%",
        "Digital Wallets (Apple Pay, Google Pay): ~8–10%",
        "Paylib (French mobile payment): ~5–6%",
        "BNPL (Klarna, Alma, Oney): ~4–5%"
      ],
      "verticals": [
        "Fashion & Luxury",
        "Travel & Tourism",
        "Electronics & Media",
        "Food & Grocery Delivery",
        "Beauty & Health"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 160–170B (2025, incl. services), third in Europe",
        "Smartphone penetration: ~87–89%",
        "Internet penetration: ~94%",
        "Strong regulatory environment (CNIL + PSD2/SCA); Carte Bancaire deeply entrenched",
        "CAGR: ~9–10% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "Carte Bancaire",
        "SEPA",
        "Klarna",
        "Credit/Debit cards",
        "Apple Pay"
      ]
    },
    {
      "country": "Spain",
      "paymentMethods": [
        "Credit/Debit Cards: ~50–55% (Visa, Mastercard)",
        "Bizum: ~10–12% (25M+ users, growing rapidly from P2P into e-commerce)",
        "PayPal: ~12–14%",
        "Bank Transfers: ~5–6%",
        "BNPL (Klarna, SeQura, Aplazame): ~4–5%",
        "COD: ~2–3% (declining)"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Travel & Hospitality",
        "Electronics & Technology",
        "Food & Grocery Delivery",
        "Health & Pharmacy"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 75–80B (2025)",
        "Smartphone penetration: ~90–92% (one of highest in Europe)",
        "Internet penetration: ~95%",
        "Bizum is the breakout story, originally P2P, now expanding into checkout; strong mobile-first behavior",
        "CAGR: ~10–12% (2024–2028, fastest in Western Europe)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "Bizum",
        "SEPA",
        "Klarna",
        "Credit/Debit cards",
        "PayPal"
      ]
    },
    {
      "country": "Netherlands",
      "paymentMethods": [
        "iDEAL: ~60–65% (overwhelmingly dominant)",
        "Credit/Debit Cards: ~10–12%",
        "BNPL (Klarna, Riverty, in3): ~8–10%",
        "PayPal: ~7–8%",
        "Bank Transfer / Direct Debit: ~3–4%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Media",
        "Home & Garden",
        "Food & Grocery",
        "Health & Beauty"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 35–38B (2025)",
        "Smartphone penetration: ~93–95%",
        "Internet penetration: ~98% (one of highest globally)",
        "iDEAL 2.0 launched, supports instant payments and QR; pan-European merchant hub",
        "CAGR: ~7–8% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "iDEAL",
        "SEPA",
        "Klarna",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Italy",
      "paymentMethods": [
        "Credit/Debit Cards + PostePay: ~35–38% (PostePay prepaid is culturally distinct, ~15–18%)",
        "PayPal: ~25–28%",
        "Bank Transfer (Bonifico): ~5–7%",
        "BNPL (Klarna, Scalapay, Soisy): ~5–6%",
        "COD (Contrassegno): ~3–4% (declining)",
        "Satispay (Italian mobile payment): ~3–4% (growing fast)"
      ],
      "verticals": [
        "Fashion & Luxury",
        "Electronics & Technology",
        "Travel & Tourism",
        "Food & Grocery",
        "Health & Pharma"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 55–60B (2025)",
        "Smartphone penetration: ~85–87%",
        "Internet penetration: ~90–92%",
        "Cash-heavy economy undergoing rapid digital transformation; government incentives for digital payments; Satispay emerging",
        "CAGR: ~11–13% (2024–2028, strong catch-up growth)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "SEPA",
        "Klarna",
        "Satispay",
        "PostePay",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Poland",
      "paymentMethods": [
        "BLIK: ~60–65% (dominant, 17M+ users)",
        "Credit/Debit Cards: ~15–18%",
        "Pay-by-link (Przelewy24, PayU, Dotpay): ~8–10%",
        "BNPL (PayPo, Klarna, Twisto): ~5–6%",
        "PayPal: ~4–5%",
        "COD: ~3–5% (declining)"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Home Appliances",
        "Health & Beauty",
        "Home & Garden",
        "Food & Grocery Delivery"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 20–22B (2025), largest in Central/Eastern Europe",
        "Smartphone penetration: ~86–88%",
        "Internet penetration: ~90–92%",
        "BLIK is the standout, real-time mobile payment, now expanding cross-border; Poland is a fintech hub",
        "CAGR: ~12–14% (2024–2028, among highest in Europe)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "BLIK",
        "Przelewy24",
        "SEPA",
        "Klarna",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Sweden",
      "paymentMethods": [
        "Klarna: ~25–28% (home market)",
        "Credit/Debit Cards: ~25–28%",
        "Swish: ~18–22% (dominant in P2P, growing in e-commerce)",
        "PayPal: ~5–7%",
        "Bank Transfer / Direct Debit: ~4–5%",
        "Trustly (open banking): ~3–4%"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics & Technology",
        "Home & Furniture",
        "Food & Grocery Delivery",
        "Health & Beauty"
      ],
      "digitalTrends": [
        "E-commerce market: ~EUR 18–20B (2025)",
        "Smartphone penetration: ~95–97% (among highest globally)",
        "Internet penetration: ~98%",
        "Nearly cashless, less than 8% of transactions use physical cash; home of Klarna, Trustly, Swish",
        "CAGR: ~8–10% (2024–2028)"
      ],
      "processors": [
        "Adyen",
        "Checkout.com",
        "ACI Enterprise",
        "Ecommpay"
      ],
      "paymentMethodsCovered": [
        "Swish",
        "Klarna",
        "Trustly",
        "SEPA",
        "Credit/Debit cards"
      ]
    }
  ],
  "MENAT": [
    {
      "country": "Saudi Arabia",
      "paymentMethods": [
        "Mada Cards: ~80% of card payments (national debit network)",
        "Credit Cards: ~15% (Visa, Mastercard)",
        "Apple Pay: ~25% adoption, fastest growing",
        "STC Pay: leading digital wallet (~12M users)",
        "Cash on Delivery: ~10% (declining)"
      ],
      "verticals": [
        "Electronics",
        "Fashion & Beauty",
        "Food Delivery",
        "Travel & Hospitality",
        "Grocery"
      ],
      "digitalTrends": [
        "E-commerce market: ~$15B (2024), projected $26B by 2028",
        "Smartphone penetration: ~98%, highest in MENA",
        "Internet penetration: ~99%",
        "CAGR: ~14% (2024–2028)",
        "Vision 2030 driving fintech licensing and SAMA-led digital push"
      ],
      "processors": [
        "HyperPay",
        "Paymob",
        "Moyasar",
        "Telr",
        "Tap"
      ],
      "paymentMethodsCovered": [
        "Mada",
        "Apple Pay",
        "STC Pay",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "United Arab Emirates",
      "paymentMethods": [
        "Credit/Debit Cards: ~50% (Visa, Mastercard dominant)",
        "Apple Pay / Google Pay: ~22%, fastest-growing channel",
        "Digital Wallets: ~15% (Careem Pay, e&)",
        "Cash on Delivery: ~10% (still relevant in mass-market e-commerce)",
        "Bank Transfers: ~5%"
      ],
      "verticals": [
        "Fashion & Luxury",
        "Electronics",
        "Beauty",
        "Travel & Tourism",
        "Food Delivery"
      ],
      "digitalTrends": [
        "E-commerce market: ~$9.2B (2024), projected ~$17B by 2027",
        "Smartphone penetration: ~99%",
        "Internet penetration: ~100%",
        "Cross-border e-commerce hub for the GCC",
        "Aani instant payment system launched; CBUAE pushing real-time rails"
      ],
      "processors": [
        "Checkout.com",
        "Telr",
        "Tap",
        "PayTabs",
        "Paymob",
        "Network International"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay",
        "Careem Pay"
      ]
    },
    {
      "country": "Turkey",
      "paymentMethods": [
        "Credit Cards: ~70% (installments / \"taksit\" dominant cultural fixture)",
        "BKM Express: ~10% bank-led wallet",
        "Digital Wallets: ~8% (Papara, ininal)",
        "Cash on Delivery: ~6%",
        "Bank Transfers: ~4% (FAST instant payments rising)"
      ],
      "verticals": [
        "Fashion & Apparel",
        "Electronics",
        "Home & Furniture",
        "Cosmetics",
        "Gaming"
      ],
      "digitalTrends": [
        "E-commerce market: ~$28B (2024), projected ~$45B by 2030",
        "Smartphone penetration: ~85%",
        "Internet penetration: ~83%",
        "FAST instant payment volume up 15% YoY",
        "Installments (\"taksit\") remain non-negotiable for card acceptance"
      ],
      "processors": [
        "iyzico",
        "PayTR",
        "Param",
        "BKM Express",
        "Sipay"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards (with installments)",
        "BKM Express",
        "Papara"
      ]
    },
    {
      "country": "Qatar",
      "paymentMethods": [
        "Credit/Debit Cards: ~60% (Visa, Mastercard)",
        "Apple Pay / Google Pay: ~18%",
        "Digital Wallets: ~10%",
        "Cash on Delivery: ~8%",
        "Bank Transfers: ~4%"
      ],
      "verticals": [
        "Fashion & Luxury",
        "Electronics",
        "Food Delivery",
        "Travel",
        "Beauty"
      ],
      "digitalTrends": [
        "E-commerce growing at 9.31% CAGR, transactions up 15% YoY in m-commerce",
        "Smartphone penetration: ~99%",
        "Internet penetration: ~99%",
        "QNB Mobile Money launched; QCB pushing instant payments"
      ],
      "processors": [
        "Tap",
        "PayTabs",
        "QNB"
      ],
      "paymentMethodsCovered": [
        "Credit/Debit cards",
        "Apple Pay",
        "Google Pay"
      ]
    },
    {
      "country": "Kuwait",
      "paymentMethods": [
        "KNET Debit: ~70% (national debit network)",
        "Credit Cards: ~18%",
        "Apple Pay / Google Pay: ~8%",
        "Cash on Delivery: ~3%",
        "Bank Transfers: ~1%"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Food Delivery",
        "Beauty",
        "Travel"
      ],
      "digitalTrends": [
        "E-commerce market: ~$1.85B (2025), projected $2.42B by 2028",
        "Smartphone penetration: ~99%",
        "KNET dominates online checkout; cards used for international"
      ],
      "processors": [
        "Tap",
        "MyFatoorah",
        "PayTabs"
      ],
      "paymentMethodsCovered": [
        "KNET",
        "Credit/Debit cards",
        "Apple Pay"
      ]
    },
    {
      "country": "Bahrain",
      "paymentMethods": [
        "BenefitPay: ~46.82% (national wallet, dominant in e-commerce)",
        "Credit/Debit Cards: ~35%",
        "Apple Pay / Google Pay: ~10%",
        "Cash on Delivery: ~6%"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Food Delivery",
        "Travel",
        "Beauty"
      ],
      "digitalTrends": [
        "Digital wallets (led by BenefitPay) hold 46.82% of e-commerce payment share",
        "Smartphone penetration: ~99%",
        "Open banking framework in force since 2020"
      ],
      "processors": [
        "BenefitPay",
        "Tap",
        "PayTabs"
      ],
      "paymentMethodsCovered": [
        "BenefitPay",
        "Credit/Debit cards"
      ]
    },
    {
      "country": "Egypt",
      "paymentMethods": [
        "Cash on Delivery: ~50% (still dominant)",
        "Cards: ~25% (Meeza national scheme + Visa, Mastercard)",
        "Mobile Wallets: ~15% (Vodafone Cash, InstaPay)",
        "Bank Transfers: ~7%",
        "Fawry Cash Voucher: ~3%"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Food Delivery",
        "Grocery",
        "Beauty"
      ],
      "digitalTrends": [
        "E-commerce scaling from ~$10B (2024) to ~$19B by 2030",
        "Mobile wallet usage up 56% YoY",
        "InstaPay rails driving sharp shift away from COD"
      ],
      "processors": [
        "Paymob",
        "Fawry",
        "Network International"
      ],
      "paymentMethodsCovered": [
        "Cards",
        "Meeza",
        "Mobile wallets",
        "Fawry"
      ]
    },
    {
      "country": "Morocco",
      "paymentMethods": [
        "Cash on Delivery: ~70% (dominant)",
        "Cards (CMI network): ~22%",
        "Mobile Wallets: ~6% (six active ecosystems)",
        "Bank Transfers: ~2%"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Grocery",
        "Food Delivery",
        "Travel"
      ],
      "digitalTrends": [
        "Six active mobile wallet ecosystems",
        "CMI runs all card acquiring in country",
        "Bank Al-Maghrib pushing instant payment rails"
      ],
      "processors": [
        "CMI",
        "Naps"
      ],
      "paymentMethodsCovered": [
        "Cards (CMI)",
        "Mobile wallets"
      ]
    },
    {
      "country": "Jordan",
      "paymentMethods": [
        "Cash on Delivery: dominant",
        "Cards: growing",
        "Mobile wallets: nascent"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Food Delivery"
      ],
      "digitalTrends": [
        "E-commerce scaling from ~$250M (2024) to ~$3.7B by 2029"
      ],
      "processors": [
        "HyperPay",
        "Tap",
        "PayTabs"
      ],
      "paymentMethodsCovered": [
        "Cards"
      ]
    },
    {
      "country": "Oman",
      "paymentMethods": [
        "Cards: ~45%",
        "Cash on Delivery: ~30%",
        "Mobile Wallets: ~15%"
      ],
      "verticals": [
        "Fashion",
        "Electronics",
        "Food Delivery"
      ],
      "digitalTrends": [
        "E-commerce scaling from ~$1.8B (2024) to ~$4.8B by 2031"
      ],
      "processors": [
        "Tap",
        "PayTabs",
        "Network International"
      ],
      "paymentMethodsCovered": [
        "Cards"
      ]
    },
    {
      "country": "Iraq",
      "paymentMethods": [
        "Cash on Delivery: dominant",
        "Cards: nascent"
      ],
      "verticals": [
        "Electronics",
        "Fashion",
        "Food Delivery"
      ],
      "digitalTrends": [
        "~$15B+ in electronic transactions processed in the last year"
      ],
      "processors": [
        "NEC Payment Services"
      ],
      "paymentMethodsCovered": []
    },
    {
      "country": "Algeria",
      "paymentMethods": [
        "Cash on Delivery: dominant",
        "SATIM cards: emerging"
      ],
      "verticals": [
        "Electronics",
        "Fashion"
      ],
      "digitalTrends": [
        "Restrictive e-commerce regulation; SATIM runs national card processing"
      ],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Tunisia",
      "paymentMethods": [
        "Cash on Delivery: dominant",
        "Cards: growing post forex reform"
      ],
      "verticals": [
        "Fashion",
        "Electronics"
      ],
      "digitalTrends": [
        "Forex restriction scrapped after 50 years; businesses can now open foreign currency accounts"
      ],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Libya",
      "paymentMethods": [
        "Cash on Delivery: dominant"
      ],
      "verticals": [
        "Electronics",
        "Fashion"
      ],
      "digitalTrends": [
        "$49.1B in electronic transactions in 2025"
      ],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Lebanon",
      "paymentMethods": [
        "Digital Wallets: replacing banks",
        "Cards: limited"
      ],
      "verticals": [
        "Fashion",
        "Electronics"
      ],
      "digitalTrends": [
        "Digital wallets replacing banks rather than complementing them"
      ],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Djibouti",
      "paymentMethods": [
        "Cash on Delivery: dominant"
      ],
      "verticals": [
        "Retail",
        "Telecom"
      ],
      "digitalTrends": [
        "Visa + government developing national digital wallet \"Smart Wallet\""
      ],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Iran",
      "paymentMethods": [],
      "verticals": [],
      "digitalTrends": ["Sanctioned market, no Yuno coverage"],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Yemen",
      "paymentMethods": [],
      "verticals": [],
      "digitalTrends": ["Active-conflict market, no Yuno coverage"],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Syria",
      "paymentMethods": [],
      "verticals": [],
      "digitalTrends": ["Sanctioned market, no Yuno coverage"],
      "processors": [],
      "paymentMethodsCovered": []
    },
    {
      "country": "Palestine",
      "paymentMethods": [],
      "verticals": [],
      "digitalTrends": ["High-risk jurisdiction, no Yuno coverage"],
      "processors": [],
      "paymentMethodsCovered": []
    }
  ]
}

// Listed in the order shown in the landing-page dropdown — alphabetical
// by the labels below so it lines up with Country Detail in the portal.
// Internal keys are kept (Americas, MENAT) to avoid renaming the slide
// data; REGION_LABEL maps them to the portal-facing names.
export const REGIONS = ['Africa', 'APAC', 'Europe', 'LATAM', 'MENAT', 'Americas']

export const REGION_LABEL = {
  Africa: 'Africa',
  Americas: 'North America',
  LATAM: 'LATAM',
  Europe: 'Europe',
  APAC: 'APAC',
  MENAT: 'Middle East',
}

// Picker-only country lists — mirror the portal's Country Detail per-region
// rosters so the dropdown shows the same set users see elsewhere in the
// portal. Slide rendering still pulls rich content from REGIONAL_DATA, so a
// country picked here without a REGIONAL_DATA entry will simply render
// region-level slides without country-specific detail.
export const COUNTRY_LIST_BY_REGION = {
  Africa: [
    'Algeria', 'Angola', 'Botswana', 'Cameroon', "Côte d'Ivoire", 'Egypt',
    'Ethiopia', 'Ghana', 'Kenya', 'Mauritius', 'Morocco', 'Mozambique',
    'Nigeria', 'Rwanda', 'Senegal', 'South Africa', 'Tanzania', 'Tunisia',
    'Uganda', 'Zambia', 'Zimbabwe',
  ],
  APAC: [
    'Australia', 'Bangladesh', 'Cambodia', 'China', 'Hong Kong', 'India',
    'Indonesia', 'Japan', 'Malaysia', 'Myanmar', 'Nepal', 'New Zealand',
    'Pakistan', 'Philippines', 'Singapore', 'South Korea', 'Sri Lanka',
    'Taiwan', 'Thailand', 'Vietnam',
  ],
  Europe: [
    'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
    'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
    'Iceland', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
    'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania',
    'Russia', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
    'Switzerland', 'Ukraine', 'United Kingdom',
  ],
  LATAM: [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Costa Rica',
    'Cuba', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Guatemala',
    'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Paraguay',
    'Peru', 'Puerto Rico', 'Trinidad and Tobago', 'Uruguay', 'Venezuela',
  ],
  MENAT: [
    'Bahrain', 'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon',
    'Oman', 'Qatar', 'Saudi Arabia', 'Turkey', 'UAE',
  ],
  Americas: [
    'Canada', 'United States',
  ],
}

// Picker variant of getRegionCountries — returns just country names so the
// landing-page dropdown can list every country the portal recognises, not
// just the ones with rich slide data in REGIONAL_DATA.
export function getRegionCountriesForPicker(region) {
  return (COUNTRY_LIST_BY_REGION[region] || []).map((country) => ({ country }))
}

export const REGION_SHORT = {
  Americas: 'Americas',
  LATAM: 'LATAM',
  Europe: 'Europe',
  APAC: 'APAC',
  MENAT: 'MENAT',
}

export const REGION_BLURB = {
  Americas: 'Deep local processor coverage across North America with global PSP redundancy.',
  LATAM: 'Local acquirers and APMs across every major LATAM market, with deep Pix and PSE coverage.',
  Europe: 'Pan-European routing with first-class APM coverage from iDEAL and Bizum to BLIK.',
  APAC: 'APAC HQ in Singapore. Local rails for UPI, GoPay, PayNow, GCash and beyond.',
  MENAT: 'Regional and global PSPs across the GCC, Levant, North Africa and Turkey.',
}

export function getRegionCountries(region) {
  return REGIONAL_DATA[region] || []
}

export function getCountryData(region, country) {
  return (REGIONAL_DATA[region] || []).find((c) => c.country === country) || null
}

export function hasCoverage(countryData) {
  return Boolean(countryData?.processors?.length)
}

// Tier classification per country. Drives the SlideRegionTierMap colour
// coding (T1 = commit & go wide, T2 = national-champion plays, T3 =
// monitor / opportunistic, high-risk = sanctioned / volatile). Countries
// not in this map fall back to tier 3 on render.
export const COUNTRY_TIER = {
  // Americas
  'United States': 1, 'Mexico': 1, 'Canada': 2,
  // LATAM
  'Brazil': 1, 'Colombia': 2, 'Chile': 2, 'Argentina': 2, 'Peru': 3,
  // Europe
  'United Kingdom': 1, 'Germany': 1, 'France': 1, 'Spain': 2, 'Netherlands': 2, 'Italy': 2, 'Poland': 3, 'Sweden': 3,
  // APAC
  'Japan': 1, 'South Korea': 1, 'Australia': 1, 'Singapore': 2, 'India': 2, 'Indonesia': 2, 'Thailand': 3, 'Philippines': 3,
  // MENAT
  'Saudi Arabia': 1, 'United Arab Emirates': 1, 'Turkey': 1,
  'Qatar': 2, 'Kuwait': 2, 'Bahrain': 2, 'Oman': 2, 'Jordan': 2,
  'Egypt': 3, 'Morocco': 3, 'Algeria': 3, 'Tunisia': 3, 'Libya': 3, 'Lebanon': 3, 'Djibouti': 3,
  'Iraq': 'high-risk', 'Iran': 'high-risk', 'Yemen': 'high-risk', 'Syria': 'high-risk', 'Palestine': 'high-risk',
}

// Unicode flag emojis. Rendered on the regional tier slide next to each
// country name in the legend column.
export const COUNTRY_FLAG = {
  'United States': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
  'Brazil': '🇧🇷', 'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Argentina': '🇦🇷', 'Peru': '🇵🇪',
  'United Kingdom': '🇬🇧', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Spain': '🇪🇸',
  'Netherlands': '🇳🇱', 'Italy': '🇮🇹', 'Poland': '🇵🇱', 'Sweden': '🇸🇪',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'India': '🇮🇳', 'Indonesia': '🇮🇩',
  'Singapore': '🇸🇬', 'Australia': '🇦🇺', 'Philippines': '🇵🇭', 'Thailand': '🇹🇭',
  'Saudi Arabia': '🇸🇦', 'United Arab Emirates': '🇦🇪', 'Turkey': '🇹🇷',
  'Qatar': '🇶🇦', 'Kuwait': '🇰🇼', 'Bahrain': '🇧🇭', 'Oman': '🇴🇲', 'Jordan': '🇯🇴',
  'Egypt': '🇪🇬', 'Morocco': '🇲🇦', 'Algeria': '🇩🇿', 'Tunisia': '🇹🇳',
  'Libya': '🇱🇾', 'Lebanon': '🇱🇧', 'Djibouti': '🇩🇯',
  'Iraq': '🇮🇶', 'Iran': '🇮🇷', 'Yemen': '🇾🇪', 'Syria': '🇸🇾', 'Palestine': '🇵🇸',
}

// Per-region tier slide metadata. `population` + `countryCount` populate
// the stats card; `intro` is the slide title copy; `tierCopy` keys tier
// id → { label, blurb, bullets }. MENAT copy mirrors the source deck
// verbatim; other regions are reasonable defaults pending sign-off.
export const REGION_META = {
  Americas: {
    intro: 'Americas spans three distinct markets; tiering keeps the GTM focused',
    population: '~510M',
    tierCopy: {
      1: {
        label: 'Tier 1, Commit & Go Wide',
        blurb: 'Largest scale, mature digital readiness, deep merchant rosters',
        bullets: [
          'USA, global merchant HQ density; deepest enterprise pipeline',
          'Mexico, fastest-growing market in LATAM, #2 by GMV',
        ],
      },
      2: {
        label: 'Tier 2, Anchor Plays',
        blurb: 'Strong digital baseline but smaller standalone pipeline',
        bullets: [
          'Canada, high digital readiness; ~60% of consumers buy from US merchants',
        ],
      },
      3: { label: 'Tier 3, Monitor', blurb: 'No T3 markets identified in Americas.', bullets: [] },
      'high-risk': { label: 'High Risk Markets', blurb: 'No high-risk markets in Americas.', bullets: [] },
    },
  },
  LATAM: {
    intro: 'LATAM spans many distinct markets; tiering keeps the GTM focused',
    population: '~660M',
    tierCopy: {
      1: {
        label: 'Tier 1, Commit & Go Wide',
        blurb: 'Largest scale, deep digital readiness',
        bullets: [
          'Brazil, Pix transforming the entire payment infrastructure; #1 in region by GMV',
        ],
      },
      2: {
        label: 'Tier 2, National-Champion Plays',
        blurb: 'Smaller standalone scale but inside the LATAM merchant ecosystem',
        bullets: [
          'Colombia, PSE-dominant; #4 e-commerce in LATAM',
          'Chile, fully cashless trajectory; CMR + Fintoc rails',
          'Argentina, Mercado Pago dominance; cross-border via dLocal',
        ],
      },
      3: {
        label: 'Tier 3, Monitor / Opportunistic',
        blurb: 'Slower digital readiness or sparser large merchants',
        bullets: ['Peru, emerging digital payments market; BNPL via Powerpay'],
      },
      'high-risk': { label: 'High Risk Markets', blurb: 'No high-risk markets in scope.', bullets: [] },
    },
  },
  Europe: {
    intro: 'Europe spans many distinct markets; tiering keeps the GTM focused',
    population: '~450M',
    tierCopy: {
      1: {
        label: 'Tier 1, Commit & Go Wide',
        blurb: 'Largest scale, mature digital readiness',
        bullets: [
          'UK, Yuno European HQ; deepest enterprise roster',
          'Germany, invoice-heavy + SEPA; largest e-commerce market in EU',
          'France, Carte Bancaire-dominant; mature market',
        ],
      },
      2: {
        label: 'Tier 2, Anchor Plays',
        blurb: 'Strong digital baseline with local APM specialisation',
        bullets: [
          'Spain, Bizum + SEPA + Klarna stack',
          'Netherlands, iDEAL ubiquity',
          'Italy, Satispay + PostePay emerging',
        ],
      },
      3: {
        label: 'Tier 3, Monitor / Opportunistic',
        blurb: 'Smaller standalone scale but distinct APM ecosystems',
        bullets: [
          'Poland, BLIK + Przelewy24 rails',
          'Sweden, Swish + Klarna headquartered',
        ],
      },
      'high-risk': { label: 'High Risk Markets', blurb: 'No high-risk markets in scope.', bullets: [] },
    },
  },
  APAC: {
    intro: 'APAC spans many distinct markets; tiering keeps the GTM focused',
    population: '~4.5B',
    tierCopy: {
      1: {
        label: 'Tier 1, Commit & Go Wide',
        blurb: 'Largest scale, mature digital readiness',
        bullets: [
          'Japan, card-dominant with PayPay + LINE Pay growth',
          'South Korea, KakaoPay + Naver Pay; high enterprise density',
          'Australia, card + BNPL stack; PayTo on NPP rails',
        ],
      },
      2: {
        label: 'Tier 2, Anchor Plays',
        blurb: 'Yuno APAC HQ in Singapore; strong local PSP rosters',
        bullets: [
          'Singapore, APAC HQ (opened Sept 2025); PayNow rails',
          'India, UPI ubiquity; fast-growing e-commerce',
          'Indonesia, wallet-driven (GoPay, OVO, Dana); largest SEA market',
        ],
      },
      3: {
        label: 'Tier 3, Monitor / Opportunistic',
        blurb: 'Distinct local rails, smaller enterprise pipeline today',
        bullets: [
          'Thailand, PromptPay-dominant; TrueMoney + Rabbit LINE Pay',
          'Philippines, GCash-dominant; growing cross-border flows',
        ],
      },
      'high-risk': { label: 'High Risk Markets', blurb: 'No high-risk markets in scope.', bullets: [] },
    },
  },
  MENAT: {
    intro: 'MENAT spans many distinct markets; tiering enables a more efficient market approach',
    population: '~600M',
    tierCopy: {
      1: {
        label: 'Tier 1, Commit & Go Wide',
        blurb: '',
        bullets: [
          'KSA, scale + fast online mix-shift; deep bench of large, recurring-payment brands',
          'UAE, high ARPU + cross-border hub; very digital',
          'Turkey, large online scale, high digital readiness (however, distinct ecosystem)',
        ],
      },
      2: {
        label: 'Tier 2, National-Champion Plays (fewer logos, quick wins) + Enable GCC Expansion',
        blurb: 'Small GCC + Jordan have limited standalone scale but sit inside the GCC merchant ecosystem. Champions in KSA/UAE often expand into Qatar, Kuwait, Oman, Bahrain, Jordan.',
        bullets: [],
      },
      3: {
        label: 'Tier 3, Monitor / Opportunistic, Explore Later',
        blurb: 'Slower digital readiness and/or sparse large merchants',
        bullets: [
          'Egypt, huge volume; lower ARPU; however high unbanked population / instalments',
          'Morocco as an emerging opportunity',
        ],
      },
      'high-risk': {
        label: 'High Risk Markets',
        blurb: 'Active-conflict, highly volatile / high-risk, or sanctioned markets',
        bullets: [],
      },
    },
  },
}

export function getCountryTier(country) {
  return COUNTRY_TIER[country] ?? 3
}

export function getCountryFlag(country) {
  return COUNTRY_FLAG[country] || '🏳️'
}

// Country list grouped by tier (1, 2, 3, 'high-risk') for a given region.
// Used both for the colour-coded map and the right-hand tier cards.
export function getRegionTierGroups(region) {
  const list = REGIONAL_DATA[region] || []
  const groups = { 1: [], 2: [], 3: [], 'high-risk': [] }
  for (const c of list) {
    const t = COUNTRY_TIER[c.country] ?? 3
    groups[t].push(c.country)
  }
  return groups
}

