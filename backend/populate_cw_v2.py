import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

def find_cw(score):
    best_c, best_w = None, None
    for c in range(101):
        w_float = 1.5 * c - score
        w = int(round(w_float))
        if abs(1.5 * c - w - score) < 0.05: # Be a bit more lenient
            if w >= 0 and c + w <= 100:
                if best_c is None or (c + w > best_c + best_w):
                    best_c, best_w = c, w
    return best_c, best_w

async def populate_cw():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    count = 0
    # Find all apps that have a score (either field) but no counts
    cursor = db.applications.find({
        '$or': [
            {'entranceMarks': {'$ne': None}},
            {'examScore': {'$ne': None}}
        ],
        '$or': [
            {'correctAnswers': None},
            {'correctAnswers': ''}
        ]
    })
    
    async for app in cursor:
        score = app.get('entranceMarks') or app.get('examScore')
        if score is None: continue
        try:
            score = float(score)
        except:
            continue
            
        c, w = find_cw(score)
        
        if c is not None:
            await db.applications.update_one(
                {'_id': app['_id']},
                {'$set': {
                    'correctAnswers': c,
                    'wrongAnswers': w
                }}
            )
            print(f"Updated {app.get('registration_id')}: Score {score} -> C:{c}, W:{w}")
            count += 1
        else:
            print(f"No valid CW for {app.get('registration_id')} Score {score}")

    print(f"Done. Updated {count} records.")

if __name__ == "__main__":
    asyncio.run(populate_cw())
