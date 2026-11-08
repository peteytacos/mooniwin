"""Local neural narration with Kokoro (Apache-2.0). No API key, runs offline.

usage: python kokoro_tts.py <model_dir> <out.wav> <voice-spec> <speed> <text>
voice-spec: a voice name ("am_michael") or a blend ("am_michael:0.6,am_fenrir:0.4")
"""
import sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

model_dir, out, spec, speed, text = sys.argv[1:6]
k = Kokoro(f"{model_dir}/kokoro-v1.0.onnx", f"{model_dir}/voices-v1.0.bin")
if ":" in spec:
    parts = [p.split(":") for p in spec.split(",")]
    voice = sum(k.get_voice_style(name) * float(w) for name, w in parts)
else:
    voice = spec
samples, sr = k.create(text, voice=voice, speed=float(speed), lang="en-us")
sf.write(out, np.asarray(samples), sr)
