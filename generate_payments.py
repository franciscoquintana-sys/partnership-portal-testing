import random
import json
from datetime import datetime
import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

N = 6000

COUNTRIES = ['Brazil', 'Mexico', 'Argentina', 'Colombia', 'Spain', 'Germany']
COUNTRY_WEIGHTS = [0.30, 0.25, 0.15, 0.15, 0.08, 0.07]

PAYMENT_METHODS_BY_COUNTRY = {
    'Brazil':    (['PIX', 'card_visa', 'card_mastercard'], [0.45, 0.30, 0.25]),
    'Mexico':    (['OXXO', 'card_visa', 'card_mastercard'], [0.40, 0.32, 0.28]),
    'Argentina': (['card_visa', 'card_mastercard'], [0.52, 0.48]),
    'Colombia':  (['card_visa', 'card_mastercard'], [0.52, 0.48]),
    'Spain':     (['SEPA', 'card_visa', 'card_mastercard'], [0.40, 0.32, 0.28]),
    'Germany':   (['SEPA', 'card_visa', 'card_mastercard'], [0.50, 0.27, 0.23]),
}

PROCESSORS = ['Processor A', 'Processor B', 'Processor C']
PROCESSOR_WEIGHTS = [0.35, 0.30, 0.35]

DECLINE_REASONS = ['insufficient_funds', 'fraud_suspicion', 'technical_error', '3ds_failure', 'expired_card']
DECLINE_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10]


def sample_amount():
    v = np.random.lognormal(mean=4.79, sigma=0.50)
    return round(float(np.clip(v, 10.0, 800.0)), 2)


def sample_approved(day, processor):
    if processor == 'Processor B' and day == 18:
        return random.random() < 0.10
    rate = 0.82 if day <= 15 else 0.70
    return random.random() < rate


def sample_decline_reason(day, country, method, processor):
    if processor == 'Processor B' and day == 18:
        if random.random() < 0.80:
            return 'technical_error'
    if day > 15 and country in ('Spain', 'Germany') and method in ('card_visa', 'card_mastercard'):
        if random.random() < 0.63:
            return '3ds_failure'
        return random.choices(
            ['insufficient_funds', 'fraud_suspicion', 'technical_error', 'expired_card'],
            [0.36, 0.30, 0.22, 0.12]
        )[0]
    return random.choices(DECLINE_REASONS, DECLINE_WEIGHTS)[0]


records = []
for i in range(N):
    day = random.randint(1, 30)
    ts = datetime(
        2023, 11, day,
        random.randint(0, 23),
        random.randint(0, 59),
        random.randint(0, 59)
    ).isoformat()

    country = random.choices(COUNTRIES, COUNTRY_WEIGHTS)[0]
    methods, mweights = PAYMENT_METHODS_BY_COUNTRY[country]
    method = random.choices(methods, mweights)[0]
    processor = random.choices(PROCESSORS, PROCESSOR_WEIGHTS)[0]
    amount = sample_amount()
    approved = sample_approved(day, processor)
    decline_reason = None if approved else sample_decline_reason(day, country, method, processor)

    records.append({
        'id':             f'txn_{i + 1:06d}',
        'timestamp':      ts,
        'country':        country,
        'payment_method': method,
        'processor':      processor,
        'amount':         amount,
        'approved':       approved,
        'decline_reason': decline_reason,
    })

with open('payments.json', 'w') as f:
    json.dump(records, f, indent=2)

df = pd.DataFrame(records)
df['day'] = df['timestamp'].str[8:10].astype(int)

total       = len(df)
overall_pct = df['approved'].mean() * 100
early_pct   = df[df['day'] <= 15]['approved'].mean() * 100
late_pct    = df[df['day'] > 15]['approved'].mean() * 100

pb18     = df[(df['processor'] == 'Processor B') & (df['day'] == 18)]
pb18_pct = pb18['approved'].mean() * 100

eu_card_late_dec = df[
    (~df['approved']) &
    (df['day'] > 15) &
    (df['country'].isin(['Spain', 'Germany'])) &
    (df['payment_method'].isin(['card_visa', 'card_mastercard']))
]
tds_pct = (eu_card_late_dec['decline_reason'] == '3ds_failure').mean() * 100

print(f"Records generated  : {total:,}")
print(f"Overall approval   : {overall_pct:.1f}%")
print(f"Nov  1-15 approval : {early_pct:.1f}%")
print(f"Nov 16-30 approval : {late_pct:.1f}%")
print()
print("Anomalies verified:")
print(f"  Processor B / Nov 18  -> {len(pb18):,} txns, {pb18_pct:.1f}% approval rate")
print(f"  Spain+Germany cards (Nov 16-30 declines) -> {tds_pct:.1f}% are 3ds_failure")
