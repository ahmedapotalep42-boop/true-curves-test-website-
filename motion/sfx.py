"""Synthesize original UI sound effects and lay them on the timeline.

usage: python3 sfx.py
  writes out/sfx/*.wav (one file per sound type), work/sfx_track.wav (full-length bed)
  and out/SFX_CUES.md
All sounds are generated here from sine waves and noise - no samples, no licensing.
"""
import json
import os
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)
clips = json.load(open('work/clips.json'))
DUR = 230.43


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, cutoff):
    """one-pole lowpass with per-sample cutoff (Hz)."""
    a = 1 - np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def norm(x, peak):
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def stereo(x, pan):
    pan = np.broadcast_to(pan, x.shape)  # -1 left .. 1 right
    return np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1)


# ---------------- sound designs ----------------
def whoosh(d=.6, peak_at=.36, lo=250, hi=3800, level=.30, pan=(-.6, .6)):
    t = t_axis(d)
    env = np.where(t < peak_at, np.sin(np.pi / 2 * np.clip(t / peak_at, 0, 1)) ** 2.2, np.exp(-(t - peak_at) / ((d - peak_at) / 3.2)))
    cut = lo + (hi - lo) * env
    n = rng.standard_normal(len(t))
    band = lowpass(n, cut) - lowpass(n, cut * .18)  # moving band-pass
    return stereo(norm(band * env, level), np.linspace(*pan, len(t)))


def pop(f=720, level=.22, pan=0):
    t = t_axis(.16)
    freq = f * (1 + .6 * np.exp(-t / .012))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    body = (np.sin(ph) + .25 * np.sin(2 * ph)) * np.exp(-t / .045) * (1 - np.exp(-t / .002))
    click = rng.standard_normal(len(t)) * np.exp(-t / .0015) * .35
    click -= lowpass(click, 2500)
    return stereo(norm(body + click, level), pan)


def tick(f=2100, level=.09, pan=0):
    t = t_axis(.05)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / .005) + rng.standard_normal(len(t)) * np.exp(-t / .001) * .3
    return stereo(norm(x, level), pan)


def swipe(level=.16, pan=(-.3, .3)):
    t = t_axis(.2)
    env = np.sin(np.pi * np.clip(t / .2, 0, 1)) ** 1.5
    n = rng.standard_normal(len(t))
    cut = np.linspace(900, 6000, len(t))
    x = lowpass(n, cut) - lowpass(n, cut * .3)
    return stereo(norm(x * env, level), np.linspace(*pan, len(t)))


def thump(level=.40):
    t = t_axis(.35)
    freq = 55 + 70 * np.exp(-t / .03)
    x = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / .09) * (1 - np.exp(-t / .002))
    out = stereo(norm(x, level * .8), 0)
    p = pop(420, level * .5)
    out[:len(p)] += p
    return out


def alert(level=.17):
    parts = []
    for f, d in ((988, .09), (784, .14)):
        t = t_axis(d + .03)
        x = (np.sin(2 * np.pi * f * t) + .18 * np.sin(6 * np.pi * f * t)) * np.minimum(1, t / .004) * np.exp(-np.maximum(0, t - d) / .01)
        parts.append(x)
    return stereo(norm(np.concatenate(parts), level), 0)


# ---------------- cue list (seconds in the source video) ----------------
cues = []  # (time, kind, kwargs, label)


def add(t, kind, label, **kw):
    cues.append((t, kind, kw, label))


ranges = sorted((c['in'], c['out']) for n, c in clips.items() if n != 'hook')
for i, (a, b) in enumerate(ranges):
    joined_in = i > 0 and abs(ranges[i - 1][1] - a) < .1
    joined_out = i + 1 < len(ranges) and abs(ranges[i + 1][0] - b) < .1
    add(a, 'whoosh', 'cut to graphic' if not joined_in else 'scene change', **({} if not joined_in else {'level': .2, 'pan': (.5, -.5)}))
    if not joined_out:
        add(b, 'whoosh_out', 'back to camera')

pops = {  # element arrivals, keyed to the animation cues in ocd.html
    'hook': [(.15, 'chip'), (1.04, '"I\'m"'), (1.34, '"so"'), (1.74, '"OCD"'), (3.24, 'desk card')],
    'not-just-tidy': [(7.8, 'Clean'), (8.32, 'Tidy'), (9.0, 'Organized')],
    'ocpd': [(17.52, 'Perfectionism'), (18.6, 'Order'), (19.42, 'Control')],
    'two-elements': [(25.56, 'Obsessions'), (25.82, 'Compulsions')],
    'obsessions': [(28.9, 'Distressing'), (29.82, 'Intrusive'), (31.18, 'Unwanted')],
    'obsession-themes': [(38.5, 'Religion'), (39.06, 'Superstition'), (41.68, 'Germs'), (43.08, 'Mistakes'), (44.94, 'Harming')],
    'compulsions': [(60.24, 'tag'), (61.44, 'tag')],
    'visible-compulsions': [(72.32, 'Washing'), (74.48, 'Checking')],
    'rule-compulsions': [(80.42, 'TV volume'), (82.88, 'Pen')],
    'mental-compulsions': [(92.02, 'Counting'), (92.98, 'Replaying'), (95.74, 'Reviewing'), (97.34, 'Reassurance')],
    'thought-vs-anxiety': [(113.2, 'The thought')],
    'lock-example': [(118.16, 'Doubt'), (119.1, 'Anxiety'), (122.58, 'Checks'), (123.32, 'Feels better')],
    'ocd-loop': [(127.0, 'card'), (127.15, 'card'), (127.3, 'card'), (127.45, 'card')],
    'no-single-cause': [(144.26, 'Genetics'), (145.24, 'Life stress'), (145.96, 'Life experiences'), (147.92, 'banner')],
    'brain-circuits': [(155.88, 'Cortex'), (156.46, 'Striatum'), (157.6, 'Thalamus')],
    'false-alarm': [(168.5, 'Cortex'), (168.85, 'Striatum'), (169.2, 'Thalamus')],
    'reassurance': [(176.35, 'bubble'), (179.76, 'chip'), (183.8, 'bubble'), (186.0, 'chip')],
    'erp': [(200.84, 'Face fears'), (202.98, 'Tolerate'), (204.68, 'No compulsions')],
    'medication': [(211.56, 'chip'), (212.62, 'chip')],
    'remember': [(222.98, 'Look'), (224.46, 'Listen'), (226.42, 'Create')],
}
for clip, items in pops.items():
    for j, (t, lab) in enumerate(items):
        # rising pitch through a sequence, slight stereo spread
        add(t, 'pop', f'{clip}: {lab}', f=620 + j * 70, pan=(-.25 + .5 * (j % 2)) * .6)

for t, lab in ((5.4, 'strike bubble'), (5.5, 'strike desk'), (8.2, 'strike Clean'), (8.85, 'strike Tidy'),
               (9.45, 'strike Organized'), (113.9, 'strike thought')):
    add(t, 'swipe', lab)
for t, lab in ((5.06, '"Probably not." stamp'), (12.59, 'OCPD'), (55.4, 'Ego-dystonic'), (115.1, 'The anxiety'),
               (130.88, '"The OCD loop"'), (132.38, '"Like a trap"')):
    add(t, 'thump', lab)
add(4.36, 'whoosh', 'punch-in', d=.35, peak_at=.18, level=.2, lo=400, hi=5000, pan=(0, 0))
add(172.6, 'alert', 'false alarm')
add(27.14, 'whoosh', 'focus obsessions', d=.4, peak_at=.2, level=.14)
# compulsions card: tick each time the box is re-checked
k = 0
while 58.1 + k * .9 < 63.0:
    add(58.1 + k * .9 + .1, 'tick', 'check')
    k += 1
for j in range(3):  # pen clicked three times
    add(83.45 + j * .14, 'tick', 'pen click', f=3200, level=.12)
for j in range(10):  # volume bars stepping down
    add(209.6 + j * .11, 'tick', 'volume step', f=1500 - j * 90, level=.08)
cues.sort()

synth = {'whoosh': whoosh, 'whoosh_out': lambda **k: whoosh(**{'d': .45, 'peak_at': .12, 'lo': 200, 'hi': 2200, 'level': .17, 'pan': (.5, -.5), **k}),
         'pop': pop, 'tick': tick, 'swipe': swipe, 'thump': thump, 'alert': alert}
LEAD = {'whoosh': lambda kw: kw.get('peak_at', .36), 'whoosh_out': lambda kw: .12}

bed = np.zeros((int((DUR + 1) * SR), 2))
for t, kind, kw, lab in cues:
    s = synth[kind](**kw)
    start = int(max(0, t - LEAD.get(kind, lambda kw: 0)(kw)) * SR)
    bed[start:start + len(s)] += s[:len(bed) - start]


def write(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


write('work/sfx_track.wav', bed[:int(DUR * SR)])
os.makedirs('out/sfx', exist_ok=True)
for name, fn in synth.items():
    write(f'out/sfx/{name}.wav', fn())

fmt = lambda t: f"{int(t // 60)}:{t % 60:05.2f}"
lines = ['# Sound effects cue sheet\n', 'All sounds are synthesized (no samples). Files in `sfx/`. '
         'Whooshes are placed so their peak lands on the cut.\n', '| Time | Sound | What it marks |', '|---|---|---|']
lines += [f'| {fmt(t)} | {kind} | {lab} |' for t, kind, _, lab in cues]
open('out/SFX_CUES.md', 'w').write('\n'.join(lines) + '\n')
print(len(cues), 'cues')
