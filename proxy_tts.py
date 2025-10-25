from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)

# CORS liberado para qualquer origem (frontend Netlify incluso)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY", "").strip()
ELEVEN_TTS_URL_TMPL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"]  = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp

@app.route("/health", methods=["GET"])
def health():
    return "ok", 200

@app.route("/tts", methods=["POST", "OPTIONS"])
def tts():
    # Preflight do navegador (CORS)
    if request.method == "OPTIONS":
        return ("", 204)

    if not ELEVEN_API_KEY:
        return jsonify(error="ELEVEN_API_KEY ausente no servidor"), 401

    data = request.get_json(silent=True) or {}
    text     = data.get("text") or ""
    # aceita voiceId OU voice_id
    voice_id = data.get("voiceId") or data.get("voice_id") or "4YYIPFl9wE5c4L2eu2Gb"
    model_id = data.get("model_id") or "eleven_multilingual_v2"
    out_fmt  = data.get("output_format") or "mp3_44100_128"

    if not text.strip():
        return jsonify(error="campo 'text' obrigatório"), 400

    url = ELEVEN_TTS_URL_TMPL.format(voice_id=voice_id)
    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        "output_format": out_fmt,
    }

    r = requests.post(url, headers=headers, json=payload, timeout=60)
    if r.status_code >= 400:
        return (r.text or f"Upstream error {r.status_code}", r.status_code)

    return Response(r.content, status=200, mimetype="audio/mpeg")
