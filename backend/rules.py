import time
from collections import deque, Counter

# Buffer lebih pendek (Responsif)
mood_buffer = deque(maxlen=10)

def evaluate_mood(features):
    if not features: return None
    if features.get("status") == "calibrating":
        return {"face_detected": True, "mood": "Calibrating...", "score": features["progress"], "conclusion": "Kalibrasi...", "recommendations": [], "server_ts": int(time.time()*1000)}

    # Extract Data
    d_mouth = features['delta_mouth']
    d_brow = features['delta_brow']
    brow_h = features['brow_height']
    face_width = features['face_width']
    drop = features['relative_drop']
    blink_dur = features['blink_dur']
    gaze = features['gaze_ratio']
    
    age_group = features.get('age', 'N/A')
    gender = features.get('gender', 'N/A')

    raw_mood = "Neutral"
    score = 50
    conclusion = "Stabil."
    recommendations = []
    
    # --- TUNING THRESHOLDS (AGAR LEBIH AKURAT) ---
    # Semakin besar angka, semakin sulit trigger mood tersebut
    
    happy_thresh = face_width * 0.06   # Mudah senyum
    
    # SUSAHKAN DETEKSI ANGRY/SAD (Anti False Positive)
    sad_thresh = - (face_width * 0.06) # Harus cemberut banget
    angry_thresh = - (face_width * 0.08) # Harus kerut banget
    
    surprise_limit = face_width * 0.16 

    # --- LOGIC ---
    if d_mouth > happy_thresh:
        raw_mood = "Happy"
        conclusion = "Senyum ceria!"
        recommendations = ["Keep Shining!"]
    elif d_brow < angry_thresh:
        raw_mood = "Angry / Serious"
        conclusion = "Kening berkerut tajam."
    elif brow_h > surprise_limit:
        raw_mood = "Surprised"
        conclusion = "Wajah terkejut."
    elif d_mouth < sad_thresh:
        raw_mood = "Sad"
        conclusion = "Tampak murung."
    elif blink_dur > 0.4 or drop > 0.45:
        raw_mood = "Exhausted"
        conclusion = "Kelelahan ekstrim!"
        recommendations = ["⚠️ TIDUR SEKARANG!"]
    elif gaze < 0.35 or gaze > 0.65:
        raw_mood = "Distracted"
        conclusion = "Mata tidak fokus."
    elif drop > 0.25: 
        raw_mood = "Tired"
        conclusion = "Mata mulai lelah."
    else:
        if drop < 0.08:
            raw_mood = "Focused"
            conclusion = "Fokus."
        else:
            raw_mood = "Neutral"
            conclusion = "Ekspresi Wajar."

    # --- VOTING SYSTEM ---
    mood_buffer.append(raw_mood)
    vote_count = Counter(mood_buffer)
    dominant_mood, count = vote_count.most_common(1)[0]
    
    # Agar tidak flicker, mood baru harus dominan > 50% buffer
    if count > 5: 
        final_mood = dominant_mood
    else:
        # Jika tidak ada yg dominan, pertahankan mood terakhir di buffer (jika mungkin)
        # Atau default ke Neutral
        final_mood = mood_buffer[-1] if len(mood_buffer) > 0 else "Neutral"
    
    if raw_mood == "Exhausted": final_mood = "Exhausted"

    mood_scores = {
        "Happy": 95, "Focused": 90, "Neutral": 80, "Surprised": 75,
        "Distracted": 60, "Tired": 40, "Sad": 30, "Angry / Serious": 20, "Exhausted": 10
    }
    score = mood_scores.get(final_mood, 50)

    return {
        "face_detected": True,
        "features": features,
        "mood": final_mood,
        "score": score,
        "conclusion": conclusion,
        "recommendations": recommendations[:3],
        "user_profile": {"age": age_group, "gender": gender},
        "server_ts": int(time.time() * 1000)
    }