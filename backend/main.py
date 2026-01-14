import warnings
# Filter warning protobuf
warnings.filterwarnings("ignore", category=UserWarning, module='google.protobuf')

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import numpy as np
import base64
import json
from model import MoodDetector
from rules import evaluate_mood

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

detector = MoodDetector()

@app.get("/")
def read_root():
    return {"status": "MoodKamu AI is Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client Connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # --- CEK APAKAH PESAN ADALAH COMMAND (JSON) ATAU GAMBAR ---
            if data.startswith('{'):
                try:
                    command = json.loads(data)
                    if command.get("action") == "calibrate":
                        detector.start_calibration()
                        # Kirim feedback instan
                        await websocket.send_text(json.dumps({"mood": "Calibrating...", "score": 0}))
                    continue # Skip processing frame, lanjut loop
                except:
                    pass # Jika gagal parse JSON, anggap mungkin string gambar rusak
            
            # --- PROSES GAMBAR ---
            try:
                if "base64," in data:
                    encoded_data = data.split(",")[1]
                else:
                    encoded_data = data
                
                nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None: continue

                features = detector.process_frame(frame)

                if features:
                    result = evaluate_mood(features)
                else:
                    result = {
                        "face_detected": False,
                        "mood": "Searching...",
                        "score": 0,
                        "conclusion": "Wajah tidak terdeteksi.",
                        "recommendations": ["Arahkan wajah ke kamera."],
                        "features": {}
                    }

                await websocket.send_text(json.dumps(result, cls=NumpyEncoder))

            except Exception as e:
                print(f"Error processing frame: {e}")

    except WebSocketDisconnect:
        print("Client Disconnected")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)