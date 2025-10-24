from flask import Flask, request, Response
from flask_cors import CORS
import os, requests

app = Flask(__name__)
from flask_cors import CORS
CORS(app, resources={r"/tts": {"origins": "*"}})

# libera CORS para o endpoint /tts (em prod, troque "*" pelo domínio do seu site)
CORS(app, resources={r"/tts": {"origins": "*"}})

ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")

@app.get("/health")
def health():
    return "ok", 200

@app.post("/tts")
def tts():
    try:
        data = request.get_json(force=True)
        text = (data.get("text") or "").strip()
        voice_id = (data.get("voiceId") or "").strip()

        if not ELEVEN_API_KEY:
            return ("API key ausente (defina ELEVEN_API_KEY).", 500)
        if not text or not voice_id:
            return ("Parâmetros 'text' e 'voiceId' são obrigatórios.", 400)

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": ELEVEN_API_KEY,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "output_format": "mp3_44100_128"
        }

        r = requests.post(url, headers=headers, json=payload, stream=True, timeout=60)
        if not r.ok:
            return (r.text, r.status_code)

        def gen():
            for chunk in r.iter_content(8192):
                if chunk:
                    yield chunk

        resp = Response(gen(), content_type="audio/mpeg")
        # CORS explícito (além do flask-cors)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp
    except Exception as e:
        return (str(e), 500)

if __name__ == "__main__":
    # Render injeta PORT; local usa 5001
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port)
