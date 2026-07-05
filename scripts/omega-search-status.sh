echo "=== processes ==="; echo "=== elo log ==="; python3 -c "
import json,os
p='tools/nn/data/omega-elo-log.jsonl'
if os.path.exists(p) and os.path.getsize(p)>0:
    rows=[json.loads(l) for l in open(p) if l.strip()]
    champ=None
    for r in rows:
        s={f\"{x['playerCount']}p\":x['winRate'] for x in r['slices']}
        if r['decision']=='PROMOTE': champ=r['candidateAggregate']
        print(f\"iter {r['iteration']:>2} {r['decision']:<7} cand={r['candidateAggregate']} champ={champ}  3p={s.get('3p')} 4p={s.get('4p')} 6p={s.get('6p')} 8p={s.get('8p')}\")
    print('promotions:', sum(1 for r in rows if r['decision']=='PROMOTE'), '/', len(rows))
else:
    print('no iterations logged yet')
"