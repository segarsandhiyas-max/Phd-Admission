import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

def find_cw(score):
    # Formula: Score = 1.5 * Correct - 1.0 * Wrong
    # Constraint: Correct + Wrong <= 100
    best_sol = None
    for c in range(101):
        w_float = 1.5 * c - score
        w = int(round(w_float))
        if w >= 0 and (c + w) <= 100:
            if abs(1.5 * c - w - score) < 0.01:
                # If multiple solutions, pick one with more attempts
                if best_sol is None or (c + w > best_sol[0] + best_sol[1]):
                    best_sol = (c, w)
    return best_sol

async def fix_all_cw():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    cursor = db.applications.find({
        '$or': [
            {'entranceMarks': {'$ne': None}},
            {'examScore': {'$ne': None}}
        ]
    })
    
    count = 0
    async for app in cursor:
        score = app.get('entranceMarks') or app.get('examScore')
        if score is None: continue
        try:
            score = float(score)
        except:
            continue
            
        c, w = find_cw(score) or (None, None)
        
        # If no exact match with 1.5, try to find the closest C and W that make sense
        if c is None:
            # Maybe it was 1 mark per question? Or maybe we just round the score.
            rounded_score = round(score * 2) / 2
            c, w = find_cw(rounded_score) or (None, None)
            
        if c is not None:
            await db.applications.update_one(
                {'_id': app['_id']},
                {'$set': {
                    'correctAnswers': c,
                    'wrongAnswers': w
                }}
            )
            print(f"Fixed {app.get('registration_id')}: Marks {score} -> C:{c}, W:{w}")
            count += 1
        else:
            # Fallback: Just set C = Score / 1.5 and W = 0 capped at 100
            c = min(100, int(round(score / 1.5)))
            w = 0
            await db.applications.update_one(
                {'_id': app['_id']},
                {'$set': {
                    'correctAnswers': c,
                    'wrongAnswers': w
                }}
            )
            print(f"Fallback {app.get('registration_id')}: Marks {score} -> C:{c}, W:{w}")
            count += 1

    print(f"Total processed: {count}")

if __name__ == "__main__":
    asyncio.run(fix_all_cw())
