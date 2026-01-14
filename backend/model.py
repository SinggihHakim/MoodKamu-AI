import cv2
import mediapipe as mp
import numpy as np
from collections import deque
import time
import threading
import os

# Set Environment untuk DeepFace agar kompatibel dengan TF 2.16
os.environ["TF_USE_LEGACY_KERAS"] = "1"

from deepface import DeepFace

class MoodDetector:
    def __init__(self):
        # MediaPipe
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # DeepFace Vars
        self.cached_age = "Scanning..."
        self.cached_gender = "..."
        self.is_analyzing_demographics = False
        
        # --- TUNING RESPONSIVITAS (FIX LAG) ---
        # Alpha 0.6 = Lebih responsif (60% data baru, 40% history)
        # Sebelumnya 0.3 (terlalu lambat)
        self.smooth_ear = 0.3
        self.smooth_mouth = 0
        self.smooth_brow = 0
        self.alpha = 0.6 
        
        self.ear_history = deque(maxlen=10)
        self.blink_start_time = 0
        self.is_blinking = False
        self.blink_count = 0
        self.system_start_time = time.time()
        self.frame_count = 0 # Counter frame
        
        # Calibration
        self.baseline_ear = 0.30
        self.base_mouth_curve = 0
        self.base_brow_squeeze = 0
        self.is_calibrating = False
        self.calibration_buffer = []
        self.calib_mouth = []
        self.calib_brow = []
        self.calibration_frames_target = 40

    # --- BACKGROUND THREAD: DEEPFACE ---
    def run_deepface_background(self, face_img):
        try:
            # Backend 'opencv' lebih cepat daripada 'ssd'
            results = DeepFace.analyze(
                img_path = face_img, 
                actions = ['age', 'gender'],
                enforce_detection = False,
                silent = True,
                detector_backend = 'opencv'
            )
            result = results[0]
            self.cached_age = str(result['age'])
            raw_gender = result['dominant_gender']
            self.cached_gender = "Male" if raw_gender == "Man" else "Female"
        except Exception as e:
            print(f"DeepFace bg error: {e}")
        finally:
            self.is_analyzing_demographics = False

    # --- GEOMETRY & LOGIC ---
    def start_calibration(self):
        self.is_calibrating = True
        self.calibration_buffer = []
        self.calib_mouth = []
        self.calib_brow = []
        print("Mulai Kalibrasi...")

    def calculate_ear(self, landmarks, indices):
        def dist(p1, p2): return np.linalg.norm(np.array(p1) - np.array(p2))
        p1, p2, p3 = landmarks[indices[0]], landmarks[indices[1]], landmarks[indices[2]]
        p4, p5, p6 = landmarks[indices[3]], landmarks[indices[4]], landmarks[indices[5]]
        val = (dist(p2, p6) + dist(p3, p5)) / (2.0 * dist(p1, p4)) if dist(p1, p4) > 0 else 0
        return val

    def get_gaze_ratio(self, mesh_points):
        def eye_ratio(iris, inner, outer):
            center_to_right = np.linalg.norm(iris - outer)
            total_width = np.linalg.norm(inner - outer)
            if total_width == 0: return 0.5
            return center_to_right / total_width
        left_iris = mesh_points[468]
        right_iris = mesh_points[473]
        return (eye_ratio(left_iris, mesh_points[33], mesh_points[133]) + 
                eye_ratio(right_iris, mesh_points[362], mesh_points[263])) / 2.0

    def analyze_environment(self, image_np, mesh_points):
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        face_width_px = np.linalg.norm(mesh_points[234] - mesh_points[454])
        return brightness, face_width_px

    def detect_emotional_features(self, mesh_points):
        lip_corners_y = (mesh_points[61][1] + mesh_points[291][1]) / 2
        lip_center_y = (mesh_points[0][1] + mesh_points[17][1]) / 2
        mouth_curve = lip_center_y - lip_corners_y 
        brow_squeeze = np.linalg.norm(mesh_points[336] - mesh_points[296])
        left_brow_h = abs(mesh_points[65][1] - mesh_points[159][1])
        right_brow_h = abs(mesh_points[295][1] - mesh_points[386][1])
        brow_height = (left_brow_h + right_brow_h) / 2
        return mouth_curve, brow_squeeze, brow_height

    def process_frame(self, image_np):
        if time.time() - self.system_start_time < 2.0: return None

        h, w, _ = image_np.shape
        rgb_image = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)

        if not results.multi_face_landmarks: return None

        landmarks = results.multi_face_landmarks[0].landmark
        mesh_points = np.array([np.multiply([p.x, p.y], [w, h]).astype(int) for p in landmarks])

        # --- OPTIMASI DEEPFACE: JARANGKAN INTERVAL ---
        self.frame_count += 1
        
        # Jika umur/gender belum ketemu, cek tiap 1 detik (30 frame)
        # Jika sudah ketemu, cek tiap 10 detik (300 frame) agar hemat CPU
        check_interval = 300 if self.cached_age != "Scanning..." else 30
        
        if self.frame_count % check_interval == 0:
            if not self.is_analyzing_demographics:
                self.is_analyzing_demographics = True
                
                x_min = max(0, np.min(mesh_points[:, 0]) - 40)
                x_max = min(w, np.max(mesh_points[:, 0]) + 40)
                y_min = max(0, np.min(mesh_points[:, 1]) - 60)
                y_max = min(h, np.max(mesh_points[:, 1]) + 40)
                
                if x_max > x_min and y_max > y_min:
                    face_img = image_np[y_min:y_max, x_min:x_max].copy()
                    if face_img.size > 0:
                        t = threading.Thread(target=self.run_deepface_background, args=(face_img,))
                        t.daemon = True
                        t.start()
                    else:
                        self.is_analyzing_demographics = False
                else:
                    self.is_analyzing_demographics = False

        # Raw Analysis
        brightness, face_width = self.analyze_environment(image_np, mesh_points)
        gaze_ratio = self.get_gaze_ratio(mesh_points)
        raw_mouth, raw_brow, raw_brow_h = self.detect_emotional_features(mesh_points)
        
        left_eye_idxs = [33, 160, 158, 133, 153, 144]
        right_eye_idxs = [362, 385, 387, 263, 373, 380]
        raw_ear = (self.calculate_ear(mesh_points, left_eye_idxs) + self.calculate_ear(mesh_points, right_eye_idxs)) / 2.0

        if self.is_calibrating:
            self.calibration_buffer.append(raw_ear)
            self.calib_mouth.append(raw_mouth)
            self.calib_brow.append(raw_brow)
            progress = int((len(self.calibration_buffer) / self.calibration_frames_target) * 100)
            if len(self.calibration_buffer) >= self.calibration_frames_target:
                self.baseline_ear = sum(self.calibration_buffer) / len(self.calibration_buffer)
                self.base_mouth_curve = sum(self.calib_mouth) / len(self.calib_mouth)
                self.base_brow_squeeze = sum(self.calib_brow) / len(self.calib_brow)
                
                # Reset smoothing ke baseline
                self.smooth_ear = self.baseline_ear
                self.smooth_mouth = self.base_mouth_curve
                self.smooth_brow = self.base_brow_squeeze
                
                self.is_calibrating = False
            return {"status": "calibrating", "progress": progress, "face_detected": True}

        # Smoothing
        self.smooth_ear = (raw_ear * self.alpha) + (self.smooth_ear * (1 - self.alpha))
        self.smooth_mouth = (raw_mouth * self.alpha) + (self.smooth_mouth * (1 - self.alpha))
        self.smooth_brow = (raw_brow * self.alpha) + (self.smooth_brow * (1 - self.alpha))
        
        delta_mouth = self.smooth_mouth - self.base_mouth_curve
        delta_brow = self.smooth_brow - self.base_brow_squeeze
        relative_drop = 1.0 - (self.smooth_ear / self.baseline_ear) if self.baseline_ear > 0 else 0

        # Blink
        blink_duration_output = 0.0
        if relative_drop > 0.35: 
            if not self.is_blinking:
                self.is_blinking = True
                self.blink_start_time = time.time()
        else:
            if self.is_blinking:
                self.is_blinking = False
                duration = time.time() - self.blink_start_time
                if duration > 0.08:
                    self.blink_count += 1
                    blink_duration_output = duration 

        # Head Tilt
        dy = mesh_points[263][1] - mesh_points[33][1]
        dx = mesh_points[263][0] - mesh_points[33][0]
        angle = np.degrees(np.arctan2(dy, dx))

        return {
            "status": "detecting",
            "ear": float(round(self.smooth_ear, 3)),
            "relative_drop": float(round(relative_drop, 2)),
            "blink_rate": int(self.blink_count),
            "blink_dur": float(round(blink_duration_output, 3)),
            "gaze_ratio": float(round(gaze_ratio, 2)),
            "head_tilt": float(round(abs(angle), 1)),
            "brightness": float(round(brightness, 1)),
            "face_width": float(round(face_width, 1)),
            "delta_mouth": float(round(delta_mouth, 1)),
            "delta_brow": float(round(delta_brow, 1)),
            "brow_height": float(round(raw_brow_h, 1)),
            "age": self.cached_age,
            "gender": self.cached_gender
        }