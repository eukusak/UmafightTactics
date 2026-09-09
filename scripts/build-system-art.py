"""Reproducible vector-authored system icons and effect frames (Pillow, CairoSVG).
No generated character art is fabricated by this script.
"""
import json, math
from pathlib import Path
import cairosvg
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
m = json.loads((ROOT / 'src/data/generated/art-manifest.json').read_text())
# Original vector motifs, drawn on a 96px canvas with transparent edges.
shapes = {
'bolt':'<path d="M54 13 27 52h20l-7 31 31-43H51Z"/>',
'shield':'<path d="m48 14 29 12-3 32Q68 76 48 85 28 76 22 58l-3-32Z"/><path d="m34 47 10 11 22-24" fill="none" stroke="#fff1bb" stroke-width="5"/>',
'crown':'<path d="m19 28 16 17 13-27 14 27 16-17-6 42H25Z"/><path d="M27 78h43" fill="none"/>',
'heart':'<path d="M48 79 21 52C0 25 34 10 48 32c14-22 48-7 27 20Z"/>',
'drop':'<path d="M48 12Q76 49 76 61a28 25 0 0 1-56 0Q20 49 48 12Z"/><path d="M31 58q-2 13 11 16" fill="none" stroke="#edffff"/>',
'book':'<path d="M16 23q18-7 32 5 14-12 32-5v53q-18-7-32 3-14-10-32-3Z"/><path d="M48 28v50M25 37l14 4M57 41l14-4M25 50l14 4M57 54l14-4" fill="none" stroke="#fff4d3" stroke-width="3"/>',
'horse':'<path d="M24 19v34q0 29 24 29t24-29V19H55v34q0 10-7 10t-7-10V19Z"/><path d="M31 30v7m0 13v7m34-27v7m0 13v7" fill="none" stroke="#fff2c4" stroke-width="4"/>',
'ribbon':'<path d="m34 50-12 33 20-7 8-21 8 21 19 7-13-36Z"/><circle cx="48" cy="35" r="23"/><path d="m48 19 5 11 12 2-9 9 2 12-10-6-11 6 2-12-8-9 12-2Z" fill="#fff3c3"/>',
'trophy':'<path d="M28 17h40v23q0 21-20 25-20-4-20-25ZM44 65h8v13H33v7h30v-7H52"/><path d="M28 24H15q-2 26 23 26m30-26h13q2 26-23 26" fill="none"/>',
'cloak':'<path d="m38 15-11 13 3 12-15 39q33 14 66 0L66 40l3-12-11-13-10 12Z"/><path d="m48 27-4 48M32 42l-7 29m39-29 7 29" fill="none" stroke="#f4e4ff" stroke-width="3"/>',
'glove':'<path d="M32 81 21 61l-7-17q-1-10 8-7l10 13V21q0-9 8-6l5 27V14q4-8 10 0l2 28 4-23q7-7 10 2l-3 24 8-16q8-4 9 4L74 63 65 81Z"/>',
'band':'<path d="M18 38q30-18 60 0v26q-30 18-60 0Z"/><path d="M18 38q30 18 60 0M32 39v25m31-25v25" fill="none" stroke="#fff2bc" stroke-width="4"/>',
'card':'<rect x="23" y="14" width="51" height="70" rx="8"/><path d="m48 30 14 19-14 19-14-19Z" fill="#f5ffff"/>',
'sword':'<path d="m68 14 14 2-2 14-36 36-14-14Z"/><path d="m25 48 24 24M36 64 18 82" fill="none" stroke-width="9"/>',
'coin':'<ellipse cx="48" cy="68" rx="29" ry="12"/><ellipse cx="48" cy="56" rx="29" ry="12"/><ellipse cx="48" cy="43" rx="29" ry="12"/><circle cx="48" cy="32" r="20"/><path d="m48 20 8 12-8 12-8-12Z" fill="#fff2bd"/>',
'star':'<path d="m48 13 11 22 25 4-18 18 4 26-22-13-23 13 5-26-18-18 25-4Z"/>',
'flag':'<path d="M24 84V16m3 3q21-12 45 0v33q-24-12-45 0"/>',
'arrow':'<path d="M16 39h39V23l27 26-27 26V59H16Z"/>',
'arc':'<path d="M24 70C-4 30 51-3 75 34l8-10v33H51l10-11C39 13 14 48 35 62Z"/>',
'track':'<ellipse cx="48" cy="48" rx="35" ry="25"/><ellipse cx="48" cy="48" rx="23" ry="13" fill="#162d42"/><path d="M16 49h17m30 0h17" fill="none" stroke="#fff4c6"/>',
'globe':'<circle cx="48" cy="48" r="32"/><ellipse cx="48" cy="48" rx="14" ry="32" fill="none" stroke="#d2fff3" stroke-width="3"/><path d="M18 38h60M18 58h60" fill="none" stroke="#d2fff3" stroke-width="3"/>',
'clock':'<circle cx="48" cy="52" r="29"/><path d="M48 26v28l17 10M37 12h22M48 12v9" fill="none" stroke="#fff2c2" stroke-width="6"/>',
'eye':'<path d="M10 48q38-49 76 0-38 49-76 0Z"/><circle cx="48" cy="48" r="15" fill="#182438"/><circle cx="52" cy="42" r="5" fill="white"/>',
'lock':'<path d="M28 43V31a20 20 0 0 1 40 0v12" fill="none" stroke-width="9"/><rect x="19" y="40" width="58" height="43" rx="7"/><path d="M48 54v17" stroke="#fff5c8" fill="none" stroke-width="7"/>',
'flower':'<path d="M48 38C9 4 2 51 36 51 2 89 48 99 48 62c37 37 57-14 13-14 40-35-14-52-13-10Z"/><circle cx="48" cy="49" r="11" fill="#fff9cc"/>',
'cube':'<path d="m48 12 31 17v39L48 86 17 68V29Z"/><path d="m17 29 31 19 31-19M48 48v38" fill="none" stroke="#fff3cd"/>',
'wing':'<path d="M17 74q8-18 12-47l10 13 8-25 10 20 21-19-7 36q-6 22-33 25Z"/><path d="m27 67 30-21" fill="none" stroke="#fff4dc"/>',
'flame':'<path d="M50 10q9 21-1 31 15-3 19-18 36 48-2 61-50 17-46-26 2-17 17-28-5 21 5 23 16-16 8-43Z"/>',
'gem':'<path d="m30 19 37 0 18 24-37 43L11 43Z"/><path d="M11 43h74M30 19l-4 24 22 43 21-43-2-24M26 43h43" fill="none" stroke="#f2ffff" stroke-width="3"/>',
'plus':'<path d="M37 15h22v22h23v22H59v23H37V59H14V37h23Z"/>',
'anvil':'<path d="M12 25h72q-5 22-31 22v14l20 17H24l16-17V47Q17 46 12 25Z"/>',
'dice':'<rect x="18" y="18" width="60" height="60" rx="12"/><g fill="#fff1bc" stroke="none"><circle cx="33" cy="32" r="5"/><circle cx="64" cy="32" r="5"/><circle cx="48" cy="48" r="5"/><circle cx="33" cy="64" r="5"/><circle cx="64" cy="64" r="5"/></g>',
'leaf':'<path d="M21 77Q9 18 79 15q8 68-58 62Z"/><path d="m21 77 42-44M34 63l-3-23m17 9 20 2" fill="none" stroke="#f2ffd0" stroke-width="4"/>',
}
traits = dict(zip([Path(x).stem for x in m['traits']], ['arrow','band','sword','arc','bolt','track','track','flag','horse','leaf','star','flower','globe','crown','arc','crown','star','trophy','ribbon','gem','crown','crown','clock','horse']))
components=['ribbon','horse','band','book','band','drop','cloak','glove','shield','card']
complete=['trophy','cloak','heart','sword','arrow','book','wing','flag','shield','flame','crown','horse','shield','shield','heart','cloak','book','leaf','horse','shield','ribbon','crown','bolt','flame','cube','glove','bolt','sword','horse','arrow','drop','crown','glove','cloak','ribbon','dice']
item_shapes=components+complete+[traits[Path(x).stem.removeprefix('emblem_')] for x in m['items'][46:62]]+['crown','cloak','shield']
assert len(item_shapes)==65
augment_shapes=['coin','arc','coin','card','arrow','band','sword','arc','cube','glove','shield','eye','cube','star','heart','sword','coin','flag','card','arc','track','leaf','trophy','anvil','anvil','drop','shield','heart','gem','card','bolt','shield','coin','crown','card','flag','shield','dice','gem','crown','plus','sword','heart','drop','card','star','cube','clock']
status_shapes=['star','lock','eye','flame','heart','shield','plus','sword','shield','shield','shield','gem','gem','bolt','clock','lock','eye','heart','clock','flag','flag','lock','arc','star']
def icon(rel, motif, index, category):
    palette=['#f8c769','#64d9ca','#88baff','#bb9df1','#f99aa6']
    color=palette[index%len(palette)]
    if category=='augments': color=['#c6d6e5','#f4ca72','#c1a4ff'][index//16]
    small=shapes[['star','bolt','drop','heart','leaf','sword','shield'][index%7]]
    decoration = f'<g transform="translate(61 61) scale(.29)" stroke-width="7">{small}</g>' if category in ['items','augments'] else ''
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x2=".2" y2="1"><stop stop-color="#ffefd0"/><stop offset=".48" stop-color="{color}"/><stop offset="1" stop-color="#34567b"/></linearGradient></defs><rect x="3" y="3" width="90" height="90" rx="23" fill="#0d1d30" stroke="{color}" stroke-opacity=".45"/><path d="M19 9h55" stroke="#f8e7b7" opacity=".4"/><g fill="url(#g)" stroke="#15243d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" transform="translate(9 8) scale(.8)">{shapes[motif]}</g><g fill="{color}" stroke="#14263f">{decoration}</g></svg>'''
    target=ASSETS/rel;target.parent.mkdir(parents=True,exist_ok=True)
    source=ASSETS/'system_vectors'/Path(rel).with_suffix('.svg');source.parent.mkdir(parents=True,exist_ok=True);source.write_text(svg)
    cairosvg.svg2png(bytestring=svg.encode(),write_to=str(target))
for cat, seq in [('items',item_shapes),('traits',list(traits.values())),('augments',augment_shapes),('status',status_shapes)]:
    assert len(m[cat])==len(seq)
    for i,(rel,motif) in enumerate(zip(m[cat],seq)):icon(rel,motif,i,cat)
# Independently animated procedural effects; first-to-last energy progression.
for idx,rel in enumerate(m['vfx']+m['starVfx']):
    large=idx>=24;cell=256 if large else 192; count=12 if large else 10; cols=6 if large else 10
    sheet=Image.new('RGBA',(cols*cell,cell*2 if large else cell))
    col=[(255,201,99),(91,234,219),(170,142,255),(255,121,94)][idx%4]
    for f in range(count):
        im=Image.new('RGBA',(cell,cell));d=ImageDraw.Draw(im);t=f/(count-1); a=int(240*math.sin(math.pi*t));c=cell/2;rad=12+t*cell*.38
        if f not in (0,count-1):
            d.ellipse((c-rad,c-rad*.58,c+rad,c+rad*.58),outline=(*col,a),width=max(2,int((1-t)*9)))
            if any(k in rel for k in ['dash','line','projectile','wedge','cone','arc']):
                for j in range(3):
                    y=c+(j-1)*17;d.line((c-rad,y,c+rad,y-10),fill=(*col,a),width=5-j)
            elif 'shield' in rel:
                d.polygon([(c,c-rad),(c+rad*.6,c-rad*.5),(c+rad*.5,c+rad*.4),(c,c+rad),(c-rad*.5,c+rad*.4),(c-rad*.6,c-rad*.5)],outline=(*col,a),width=5)
            elif 'heal' in rel or 'buff' in rel:
                d.rectangle((c-5,c-rad*.6,c+5,c+rad*.6),fill=(*col,a));d.rectangle((c-rad*.6,c-5,c+rad*.6,c+5),fill=(*col,a))
            else:
                for j in range(8):
                    angle=j*math.pi/4+t; x=c+math.cos(angle)*rad; y=c+math.sin(angle)*rad*.7
                    d.line((c,c,x,y),fill=(*col,a),width=3)
            for j in range(6):
                angle=j*math.pi/3+t*2;x=c+math.cos(angle)*rad;y=c+math.sin(angle)*rad
                d.ellipse((x-2,y-2,x+2,y+2),fill=(255,248,220,a))
            glow=im.filter(ImageFilter.GaussianBlur(5));glow.alpha_composite(im);im=glow
        sheet.alpha_composite(im,((f%cols)*cell,(f//cols)*cell))
        target=ASSETS/'vfx/frames'/Path(rel).stem/f'{f:02}.png';target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
    sheet.save(ASSETS/rel)
    metadata={'sheet':rel,'cell':[cell,cell],'anchor':[cell//2,cell//2],'fps':20 if large else 15,'loop':False,'files':[f'vfx/frames/{Path(rel).stem}/{f:02}.png' for f in range(count)]}
    (ASSETS/'vfx/frames'/Path(rel).stem/'animation.json').write_text(json.dumps(metadata,indent=2)+'\n')
# Inventory lists only actual files; reference previews are not delivery entries.
files=sorted(str(p.relative_to(ASSETS)) for p in ASSETS.rglob('*.png') if '/race/' not in str(p) and '/reference_previews/' not in str(p))
(ROOT/'src/data/manual/delivered-art.json').write_text(json.dumps(files,indent=2)+'\n')
print('System icons:',161,'VFX sheets:',27,'VFX frames:',276)
# UI atlases retain the documented cell coordinates; CSS also has vector equivalents.
def panel(w,h,color,mode=0):
    im=Image.new('RGBA',(w,h));d=ImageDraw.Draw(im)
    d.rounded_rectangle((2,2,w-3,h-3),radius=min(14,w//5),fill=(17+mode*3,37+mode*3,56+mode*3,242),outline=color,width=2)
    d.line((12,5,w-13,5),fill=(255,239,201,90),width=1)
    return im
colors=[(139,169,185,230),(99,198,144,230),(103,169,245,230),(185,155,245,230),(242,207,131,240),(103,191,192,230),(118,144,160,190),(218,245,230,250)]
frames=Image.new('RGBA',(384,192))
for row in range(4):
 for col in range(8):frames.alpha_composite(panel(48,48,colors[col],row), (col*48,row*48))
frames.save(ASSETS/'ui/ui_frames.png')
slots=Image.new('RGBA',(1536,512))
for row in range(2):
 for col in range(8):slots.alpha_composite(panel(192,256,colors[col],row),(col*192,row*256))
slots.save(ASSETS/'ui/ui_slots.png')
tiles=Image.new('RGBA',(768,96))
for i,color in enumerate([colors[0],colors[7],colors[4],colors[5],(255,133,131,220),colors[2]]):
 tile=Image.new('RGBA',(128,96));d=ImageDraw.Draw(tile);d.polygon([(64,3),(123,26),(123,70),(64,93),(5,70),(5,26)],fill=(*color[:3],22 if i==0 else 60),outline=color,width=2);tiles.alpha_composite(tile,(128*i,0))
tiles.save(ASSETS/'ui/board_hex_tiles.png')
for i,rel in enumerate(m['banners']):
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="180"><defs><linearGradient id="banner"><stop stop-color="#19354d" stop-opacity="0"/><stop offset=".2" stop-color="#19354d"/><stop offset=".8" stop-color="#19354d"/><stop offset="1" stop-color="#19354d" stop-opacity="0"/></linearGradient></defs><path d="m0 35 480-20 480 20v110l-480 20L0 145Z" fill="url(#banner)"/><path d="m30 35 450-20 450 20M30 145l450 20 450-20" stroke="{'#e9c785' if i not in (5,10) else '#df9694'}" fill="none" stroke-width="2"/><g fill="#dfc17b" stroke="#122b3d" stroke-width="3" transform="translate(90 44) scale(.95)">{shapes[['flag','book','sword','clock','ribbon','shield','track','horse','card','gem','wing','crown'][i]]}</g></svg>'''
 cairosvg.svg2png(bytestring=svg.encode(),write_to=str(ASSETS/rel))
# Five original geometric PvE characters, articulated in vector form.
for idx,rel in enumerate(m['pve']):
 sheet=Image.new('RGBA',(1280,512));kind=Path(rel).stem
 for row,count in [(0,6),(1,8),(3,6)]:
  for frame in range(count):
   t=frame/max(1,count-1);bob=math.sin(t*math.pi*2)*2 if row==0 else 0
   arm=math.sin(t*math.pi)*-65 if row==1 else 0
   tilt=t*78 if row==3 else 0
   drop=t*6 if row==3 else 0
   color=['#bd8a51','#6b9c8d','#9ebfd2','#e0b952','#eed794'][idx]
   body = '<path d="M45 57h38v40H45Z"/><path d="M45 62h38M45 87h38" fill="none"/>' if idx==0 else '<path d="m39 58 25-8 25 8-6 40H45Z"/>'
   head = '<circle cx="64" cy="41" r="18"/>' if idx==0 else '<rect x="44" y="23" width="40" height="35" rx="10"/>'
   crown='<path d="m44 26-4-13 14 8 10-15 11 15 13-8-4 13Z" fill="#fff0bc"/>' if idx>=3 else ''
   svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><linearGradient id="body" x2=".3" y2="1"><stop stop-color="#faf0d3"/><stop offset=".45" stop-color="{color}"/><stop offset="1" stop-color="#304f60"/></linearGradient></defs><g transform="translate(10.24 17.6) scale(.84)"><g transform="translate(0 {bob+drop}) rotate({tilt} 64 70)" fill="url(#body)" stroke="#193045" stroke-width="3" stroke-linejoin="round"><path d="M49 92v17H37v6h21V92m13 0v23h20v-6H79V92"/>{body}<g transform="rotate({arm} 83 62)"><path d="M82 58h12l10 28-11 4-13-23Z"/></g><g transform="rotate({-arm*.4} 43 62)"><path d="M44 58H32L22 83l10 5 14-21Z"/></g>{head}{crown}<path d="M52 39h7m11 0h7" stroke="#62ffe2" stroke-width="5"/><path d="M57 48h14" stroke="#223f54" stroke-width="2"/><path d="m64 66 8 10-8 9-8-9Z" fill="#73e9d5"/></g></g></svg>'''
   png=cairosvg.svg2png(bytestring=svg.encode(),output_width=384,output_height=384)
   import io
   im=Image.open(io.BytesIO(png)).resize((128,128),Image.Resampling.LANCZOS);sheet.alpha_composite(im,(frame*128,row*128))
   target=ASSETS/'pve/frames'/kind/{0:'idle',1:'basic_attack',3:'ko'}[row]/f'{frame:02}.png';target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
 sheet.save(ASSETS/rel)
 clips={name:{'fps':fps,'loop':name=='idle','files':[f'pve/frames/{kind}/{name}/{f:02}.png' for f in range(count)]} for name,count,fps in [('idle',6,8),('basic_attack',8,14),('ko',6,10)]}
 (ASSETS/'pve/frames'/kind/'animation.json').write_text(json.dumps({'sheet':rel,'cell':[128,128],'anchor':[64,110],'clips':clips},indent=2)+'\n')
files=sorted(str(p.relative_to(ASSETS)) for p in ASSETS.rglob('*.png') if '/race/' not in str(p) and '/reference_previews/' not in str(p))
(ROOT/'src/data/manual/delivered-art.json').write_text(json.dumps(files,indent=2)+'\n')
print('UI atlases: 3; banners: 12; PvE sheets: 5; PvE frames: 120')
