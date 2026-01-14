// Web Worker untuk memproses gambar tanpa memblokir UI thread
self.onmessage = async (event) => {
    const { imageBitmap, width, height } = event.data;

    // Menggunakan OffscreenCanvas (Fitur modern browser)
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw dan Resize otomatis karena ukuran canvas sudah ditentukan (320x240)
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Konversi ke Blob (JPEG compression)
    const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.7 // Kompresi 70%
    });

    // Baca blob sebagai base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
        // Kirim hasil string base64 kembali ke main thread
        self.postMessage(reader.result);
    };
};