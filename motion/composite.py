"""Cut the rendered clips into the source video for review.

usage: python3 composite.py
  reads work/source.mp4, work/clips.json and out/*.mp4|.mov, writes
  out/preview.mp4 (graphics only) and out/preview_subtitled.mp4 (+ out/subtitles.ass)
"""
import glob
import json
import subprocess

clips = json.load(open('work/clips.json'))
W, H = 1024, 576
PUNCH = (4.36, 5.98)  # hook punch-in on "Well, you're probably not."


def clip_file(name):
    return glob.glob(f'out/*_{name}.mp4') + glob.glob(f'out/*_{name}.mov')


args = ['ffmpeg', '-loglevel', 'error', '-y', '-i', 'work/source.mp4']
graph = [f"[0:v]split[a][b];[b]scale=iw*1.15:ih*1.15,crop={W}:{H}:(iw-{W})/2:(ih-{H})*0.3[z];"
         f"[a][z]overlay=enable='between(t,{PUNCH[0]},{PUNCH[1]})'[v0]"]
prev, n = '[v0]', 0
for name, c in clips.items():
    n += 1
    args += ['-i', clip_file(name)[0]]
    a, b = c['in'], c['out']
    graph.append(f"[{n}:v]scale={W}:{H}:flags=lanczos,setpts=PTS-STARTPTS+{a}/TB,tpad=stop_mode=clone:stop_duration=1[c{n}]")
    graph.append(f"{prev}[c{n}]overlay=eof_action=pass:enable='between(t,{a},{b})'[v{n}]")
    prev = f'[v{n}]'
enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart']
subprocess.run(args + ['-filter_complex', ';'.join(graph), '-map', prev, '-map', '0:a', *enc, 'out/preview.mp4'], check=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'out/preview.mp4', '-vf',
                'ass=out/subtitles.ass:fontsdir=/usr/share/fonts/opentype/inter', *enc, 'out/preview_subtitled.mp4'], check=True)
