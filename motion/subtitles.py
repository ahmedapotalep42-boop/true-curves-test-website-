"""Build minimal word-by-word subtitles (ASS + SRT) from word timings.

No captions while a graphic is on screen.

usage: python3 subtitles.py work/words.json work/clips.json out/subtitles
"""
import json
import sys

words_path, clips_path, out_base = sys.argv[1:4]
words = [w for w in json.load(open(words_path))['words'] if w.get('type') == 'word']
clips = list(json.load(open(clips_path)).values())

MAX_WORDS, MAX_CHARS, GAP = 5, 30, 0.45


def in_graphic(t):
    return any(c['in'] <= t < c['out'] for c in clips)


# group words into short phrases: break on punctuation, pauses, length, and graphic cuts
phrases, cur = [], []
for i, w in enumerate(words):
    if cur:
        prev = cur[-1]
        text_len = len(' '.join(x['text'] for x in cur + [w]))
        if (len(cur) >= MAX_WORDS or text_len > MAX_CHARS or w['start'] - prev['end'] > GAP
                or prev['text'][-1] in '.?!,' and len(cur) >= 2
                or in_graphic(prev['start']) != in_graphic(w['start'])):
            phrases.append(cur)
            cur = []
    cur.append(w)
phrases.append(cur)


def ts(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def srt_ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1024
PlayResY: 576
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Face,Inter SemiBold,28,&H00FFFFFF,&H00FFFFFF,&H00000000,&H8C000000,0,0,0,0,100,100,0,0,1,0,1.4,2,60,60,40,1
Style: Graphic,Inter SemiBold,19,&H00303030,&H00303030,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,60,60,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events, srt = [], []
for n, p in enumerate(phrases):
    start = p[0]['start']
    nxt = phrases[n + 1][0]['start'] if n + 1 < len(phrases) else p[-1]['end'] + 1
    end = min(p[-1]['end'] + 0.35, nxt)
    if in_graphic(start):
        continue  # graphics carry their own text on screen
    style = 'Face'
    parts = []
    for w in p:
        a = int((w['start'] - start) * 1000)
        # each word: hidden + soft blur, then fades/sharpens in on its own start time
        parts.append(f"{{\\alpha&HFF&\\blur3\\t({a},{a + 160},\\alpha&H00&\\blur0)}}{w['text']}")
    events.append(f"Dialogue: 0,{ts(start)},{ts(end)},{style},,0,0,0,,{{\\fad(0,120)}}" + ' '.join(parts))
    srt.append(f"{len(srt) + 1}\n{srt_ts(start)} --> {srt_ts(end)}\n{' '.join(w['text'] for w in p)}\n")

open(out_base + '.ass', 'w').write(head + '\n'.join(events) + '\n')
open(out_base + '.srt', 'w').write('\n'.join(srt))
print(len(phrases), 'phrases')
