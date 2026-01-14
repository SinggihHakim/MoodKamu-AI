MoodKamu AI - Realtime Emotion Detector 🎭MoodKamu adalah aplikasi web interaktif berbasis Artificial Intelligence yang mendeteksi emosi, umur, dan gender pengguna secara realtime melalui webcam. Proyek ini menggabungkan kecepatan Next.js di sisi pengguna dan kecerdasan Python (Deep Learning) di sisi server.🚀 Fitur UtamaDeteksi Emosi Realtime: Menganalisis ekspresi wajah (Senang, Sedih, Marah, Fokus, Lelah) dengan latensi rendah.Face Mesh Technology: Melacak 468 titik wajah menggunakan MediaPipe untuk akurasi tinggi.Analisis Demografi: Estimasi Umur dan Gender menggunakan DeepFace (TensorFlow).Adaptive Threshold: Algoritma pintar yang menyesuaikan sensitivitas berdasarkan jarak dan bentuk wajah pengguna.Health Alerts: Peringatan otomatis jika pengguna terdeteksi "Lelah" atau "Mengantuk" (berdasarkan durasi kedipan mata).🛠️ Tech Stack🧠 Backend (AI Processing)Python 3.10+FastAPI: Framework server modern dan super cepat.Uvicorn: ASGI Server.MediaPipe: Ekstraksi landmark wajah yang ringan.DeepFace: Library Deep Learning untuk analisis wajah lanjutan.OpenCV & NumPy: Pemrosesan citra digital dan kalkulasi matriks.💻 Frontend (User Interface)Next.js: React Framework untuk performa web yang optimal.WebSocket API: Komunikasi data dua arah secara realtime antara client dan server.CSS Modules: Styling antarmuka.📋 Prasyarat (Requirements)Sebelum memulai, pastikan komputer Anda sudah terinstall:Git (Untuk meng-clone repository).Node.js (Versi 16 atau terbaru) & npm.Python (Versi 3.9 atau terbaru).Webcam (Wajib untuk input video).⚙️ Cara Install & Menjalankan (Step-by-Step)Ikuti langkah-langkah ini untuk menjalankan proyek di komputer lokal Anda.1. Clone RepositoryDownload source code proyek ini ke komputer Anda.git clone [https://github.com/SinggihHakim/MoodKamu-AI.git](https://github.com/SinggihHakim/MoodKamu-AI.git)
cd MoodKamu-AI
2. Setup Backend (Server AI)Backend bertugas memproses video dan menjalankan model AI. Backend akan berjalan di Port 8001.Buka terminal, lalu jalankan perintah berikut:# 1. Masuk ke folder backend
cd backend

# 2. Buat Virtual Environment (Agar library tidak konflik dengan sistem)
# Untuk Windows:
python -m venv venv
# Untuk Mac/Linux:
# python3 -m venv venv

# 3. Aktifkan Virtual Environment
# Untuk Windows:
.\venv\Scripts\activate
# Untuk Mac/Linux:
# source venv/bin/activate

# 4. Install Library AI
# (Proses ini mungkin memakan waktu karena mendownload DeepFace & TensorFlow)
pip install fastapi uvicorn opencv-python numpy mediapipe deepface tf-keras
Jalankan Server Backend:# Pastikan Anda masih di dalam folder backend dan venv sudah aktif
uvicorn main:app --reload --host 0.0.0.0 --port 8001
Tunggu hingga muncul pesan: Uvicorn running on http://0.0.0.0:80013. Setup Frontend (Tampilan Web)Frontend bertugas menampilkan kamera dan hasil analisis. Frontend akan berjalan di Port 3000.Buka Terminal Baru (jangan matikan terminal backend), lalu jalankan:# 1. Masuk ke folder frontend
cd frontend

# 2. Install Dependencies (Wajib!)
# Langkah ini akan mendownload semua modul Next.js yang dibutuhkan
npm install

# 3. Jalankan Frontend Development Server
npm run dev
4. Akses Aplikasi 🌐Buka browser (Google Chrome atau Microsoft Edge disarankan).Kunjungi alamat: http://localhost:3000Browser akan meminta izin akses kamera. Klik Allow / Izinkan.Tunggu beberapa detik, wajah Anda akan terdeteksi dan status emosi akan muncul!⚠️ Troubleshooting (Masalah Umum)Q: Kamera tidak muncul atau status "Menunggu koneksi..." terus?Cek Port Backend: Pastikan Backend berjalan di port 8001, bukan 8000.Cek WebSocket: Pastikan file frontend/pages/index.js mengarah ke IP 127.0.0.1.const socket = new WebSocket("ws://127.0.0.1:8001/ws");
(Hindari penggunaan localhost di URL WebSocket pada Windows untuk mencegah delay IPv6).Q: Terminal Backend diam/stuck saat pertama kali dijalankan?Ini normal. Saat pertama kali run, DeepFace sedang mendownload file bobot model (sekitar 500MB+). Jangan tutup terminal, biarkan hingga selesai.Q: Error npm command not found?Pastikan Anda sudah menginstall Node.js di komputer Anda.🤝 KontribusiTertarik mengembangkan proyek ini? Silakan fork repository ini dan buat Pull Request!Created with ❤️ by Singgih Hakim
