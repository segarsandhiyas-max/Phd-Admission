import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

def find_cw(score):
    best_c, best_w = None, None
    for c in range(101):
        w_float = 1.5 * c - score
        w = int(round(w_float))
        if abs(1.5 * c - w - score) < 0.05:
            if w >= 0 and c + w <= 100:
                if best_c is None or (c + w > best_c + best_w):
                    best_c, best_w = c, w
    return best_c, best_w

async def populate_cw():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    # Use $and to avoid key collision in dictionary
    query = {
        '$and': [
            {
                '$or': [
                    {'entranceMarks': {'$ne': None}},
                    {'examScore': {'$ne': None}}
                ]
            },
            {
                '$or': [
                    {'correctAnswers': {'$exists': False}},
                    {'correctAnswers': None},
                    {'correctAnswers': ''},
                    {'correctAnswers': 0} # Just in case it was 0 but should be something else
                ]
            }
        ]
    }
    
    cursor = db.applications.find(query)
    count = 0
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
