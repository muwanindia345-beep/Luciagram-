const MUWAN_URL = process.env.MUWAN_URL || 'https://muwandb-server.onrender.com'\;
const MUWAN_API_KEY = process.env.MUWAN_API_KEY;
const MUWAN_SECRET_KEY = process.env.MUWAN_SECRET_KEY;
const BUCKET_NAME = 'post-media';

async function uploadToBucket(base64, ext = 'jpg') {
    try {
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        const res = await fetch(`${MUWAN_URL}/bucket/${BUCKET_NAME}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MUWAN_API_KEY
            },
            body: JSON.stringify({ base64: base64Data, ext })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return {
            fileId: data.data.fileId,
            url: `${MUWAN_URL}${data.data.url}`,
            error: null
        };
    } catch (err) {
        return { fileId: null, url: null, error: err.message };
    }
}

async function deleteFromBucket(fileId) {
    try {
        const res = await fetch(`${MUWAN_URL}/bucket/${BUCKET_NAME}/${fileId}`, {
            method: 'DELETE',
            headers: { 'x-secret-key': MUWAN_SECRET_KEY }
        });
        const data = await res.json();
        return { success: res.ok, error: data.error || null };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function ensureBucket() {
    try {
        await fetch(`${MUWAN_URL}/bucket/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-secret-key': MUWAN_SECRET_KEY
            },
            body: JSON.stringify({ name: BUCKET_NAME })
        });
    } catch (err) {
        console.warn('[Bucket] ensureBucket error:', err.message);
    }
}

ensureBucket();

module.exports = { uploadToBucket, deleteFromBucket };
