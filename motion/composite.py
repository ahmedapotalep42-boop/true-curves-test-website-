"""Cut the rendered clips into the source video for review.

usage: python3 composite.py [dir] [fps]
  reads <dir>/work/source.mp4, <dir>/work/clips.json and <dir>/out/*.mp4|.mov, writes
  out/preview.mp4 (graphics) and out/preview_subtitled.mp4 (+ out/subtitles.ass)

Every cut between the footage and a graphic is a lens-blur transition: the frame
defocuses toward the cut, the two shots cross-dissolve at peak blur, then refocus.
"""
import glob
import json
import os
import subprocess
import sys

BASE = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else ''
# seconds of dead air trimmed off the head of the review preview
TRIM = float(sys.argv[2]) if len(sys.argv) > 2 else 0
clips = json.load(open(BASE + 'work/clips.json'))
W, H = 1024, 576
# optional hook punch-in, per video
PUNCH = (4.36, 5.98) if not BASE else None
XF = .12  # half-length of the cross-dissolve (s)
# (distance from cut, blur sigma): sigma used while |t - cut| is below the distance
BLUR = [(.035, 18), (.07, 13), (.11, 8.5), (.16, 5), (.22, 2.2)]


def clip_file(name):
    return glob.glob(f'{BASE}out/*_{name}.mp4') + glob.glob(f'{BASE}out/*_{name}.mov')


args = ['ffmpeg', '-loglevel', 'error', '-y', '-i', BASE + 'work/source.mp4']
graph = ([f"[0:v]split[a][b];[b]scale=iw*1.15:ih*1.15,crop={W}:{H}:(iw-{W})/2:(ih-{H})*0.3[z];"
          f"[a][z]overlay=enable='between(t,{PUNCH[0]},{PUNCH[1]})'[v0]"] if PUNCH
         else ["[0:v]null[v0]"])
prev, n, cuts = '[v0]', 0, set()
for name, c in clips.items():
    n += 1
    args += ['-i', clip_file(name)[0]]
    a, b = c['in'], c['out']
    fade_in = a > 0  # the hook starts the video; nothing to dissolve from
    # an opaque graphic followed directly by another stays solid; the next one dissolves over it
    fade_out = c.get('alpha') or not any(abs(o['in'] - b) < .05 for o in clips.values())
    s0 = a - XF if fade_in else a
    graph.append(
        f"[{n}:v]scale={W}:{H}:flags=lanczos,format=yuva420p,"
        f"tpad=start_mode=clone:start_duration={XF if fade_in else 0}:stop_mode=clone:stop_duration=1,"
        f"setpts=PTS-STARTPTS+{s0}/TB"
        + (f",fade=t=in:st={a - XF}:d={2 * XF}:alpha=1" if fade_in else "")
        + (f",fade=t=out:st={b - XF}:d={2 * XF}:alpha=1" if fade_out else "") + f"[c{n}]")
    graph.append(f"{prev}[c{n}]overlay=eof_action=pass:enable='between(t,{s0},{b + XF})'[v{n}]")
    prev = f'[v{n}]'
    if not c.get('alpha'):  # overlays sit on a continuous shot - no blur cut
        cuts.update(t for t in (a, b) if t > 0)

cuts = sorted(cuts)
for i, (dist, sigma) in enumerate(BLUR):
    lo = BLUR[i - 1][0] if i else 0
    expr = '+'.join(f"between(abs(t-{t}),{lo},{dist})" for t in cuts)
    graph.append(f"{prev}gblur=sigma={sigma}:steps=2:enable='{expr}'[b{i}]")
    prev = f'[b{i}]'

enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'copy']
subprocess.run(args + ['-filter_complex', ';'.join(graph), '-map', prev, '-map', '0:a', *enc, BASE + 'out/preview.mp4'], check=True)
sub = BASE + ('out/_subtitled_full.mp4' if TRIM else 'out/preview_subtitled.mp4')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', BASE + 'out/preview.mp4', '-vf',
                f'ass={BASE}out/subtitles.ass:fontsdir=/usr/share/fonts/opentype/inter', *enc, sub], check=True)
if TRIM:  # drop the dead air at the head, after the subtitles are burned in
    # re-encode rather than stream-copy: a copy would snap back to the nearest keyframe
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(TRIM), '-i', sub,
                    *enc[:-2], '-c:a', 'aac', '-b:a', '192k',  # enc[:-2] drops the "-c:a copy" pair
                    BASE + 'out/preview_subtitled.mp4'], check=True)
    os.remove(sub)
