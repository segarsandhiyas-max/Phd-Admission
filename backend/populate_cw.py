import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

def find_cw(score):
    # Try to find integers C, W such that 1.5*C - W = score and C+W <= 100
    best_c, best_w = None, None
    for c in range(101):
        w_float = 1.5 * c - score
        w = int(round(w_float))
        # Check if this combination yields the score
        if abs(1.5 * c - w - score) < 0.01:
            if w >= 0 and c + w <= 100:
                # Prefer solutions with higher attempts if multiple exist
                if best_c is None or (c + w > best_c + best_w):
                    best_c, best_w = c, w
    return best_c, best_w

async def populate_cw():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    count = 0
    cursor = db.applications.find({
        'entranceMarks': {'$ne': None},
        'correctAnswers': None
    })
    
    async for app in cursor:
        score = float(app.get('entranceMarks'))
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
            # If no exact match, try rounding to nearest 0.5
            rounded_score = round(score * 2) / 2
            c, w = find_cw(rounded_score)
            if c is not None:
                await db.applications.update_one(
                    {'_id': app['_id']},
                    {'$set': {
                        'correctAnswers': c,
                        'wrongAnswers': w
                    }}
                )
                print(f"Updated {app.get('registration_id')} (Rounded {score}->{rounded_score}): C:{c}, W:{w}")
                count += 1
            else:
                print(f"Could not find valid C,W for {app.get('registration_id')} (Score {score})")
                
    print(f"Successfully updated {count} applications.")

if __name__ == "__main__":
    asyncio.run(populate_cw())
