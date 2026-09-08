"""Import a reviewed transparent 10x6 character sheet into 46 individual PNGs.
Never guesses object bounds, removes a background, copies frames, or trims limbs.
Usage: python3 scripts/slice-character-sheet.py UNIT_ID /absolute/sheet.png
Requires Pillow. Review alpha and poses before import.
"""
import argparse, json, hashlib, tempfile, shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CLIPS={'idle':(0,6,8),'run':(10,8,12),'basic_attack':(20,8,14),'skill_cast':(30,10,15),'ko':(44,6,10),'victory':(50,8,10)}
def validate(image):
    if image.mode!='RGBA': raise ValueError('Actual RGBA required; opaque/checkerboard RGB sheets are rejected.')
    w,h=image.size
    if w%10 or h%6 or w//10!=h//6: raise ValueError('Exact 10x6 square-cell grid required; no inferred slicing.')
    cell=w//10
    occupied={i for start,count,_ in CLIPS.values() for i in range(start,start+count)}
    for i in range(60):
        tile=image.crop(((i%10)*cell,(i//10)*cell,(i%10+1)*cell,(i//10+1)*cell))
        alpha=tile.getchannel('A'); box=alpha.getbbox()
        if i not in occupied:
            if box is not None: raise ValueError(f'Blank cell {i} contains pixels.')
        else:
            if box is None: raise ValueError(f'Frame {i} is empty.')
            if min(box[0],box[1],cell-box[2],cell-box[3])<2: raise ValueError(f'Frame {i} touches the cell edge; inspect cropping.')
            if alpha.getextrema()[0]!=0: raise ValueError(f'Frame {i} lacks transparent space.')
    return cell

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('unit_id');parser.add_argument('sheet',type=Path);args=parser.parse_args()
    units=json.loads((ROOT/'src/data/generated/all-units.json').read_text())['units']
    unit=next((u for u in units if u['id']==args.unit_id),None)
    if unit is None:parser.error('Unknown exact unit ID')
    image=Image.open(args.sheet);cell=validate(image)
    dest=ROOT/'public/assets/characters/frames'/args.unit_id
    if dest.exists():parser.error('Destination already exists; preserve the reviewed version before importing a replacement.')
    sheet_dest=ROOT/'public/assets/characters'/f'{args.unit_id}.png'
    if sheet_dest.exists():parser.error('Battle sheet already exists; explicit version management is required.')
    with tempfile.TemporaryDirectory() as temp:
        staging=Path(temp); manifest={'unitId':args.unit_id,'cell':[128,128],'anchor':[64,110],'skillTemplate':unit['skill']['template'],'sourceSha256':hashlib.sha256(args.sheet.read_bytes()).hexdigest(),'clips':{}}
        for name,(start,count,fps) in CLIPS.items():
            folder=staging/name;folder.mkdir();files=[]
            for n in range(count):
                i=start+n;tile=image.crop(((i%10)*cell,(i//10)*cell,(i%10+1)*cell,(i//10+1)*cell))
                # Keep the same whole-cell coordinate system; no per-frame auto-centering jitter.
                tile.resize((128,128),Image.Resampling.LANCZOS).save(folder/f'{n:02}.png')
                files.append(f'characters/frames/{args.unit_id}/{name}/{n:02}.png')
            manifest['clips'][name]={'fps':fps,'loop':name in ('idle','run','victory'),'files':files}
        (staging/'animation.json').write_text(json.dumps(manifest,indent=2)+'\n')
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(staging,dest)
        image.resize((1280,768),Image.Resampling.LANCZOS).save(sheet_dest)
    print(f'Imported {args.unit_id}: 46 actual frames, 6 clips. Run python3 scripts/build-system-art.py to refresh the asset inventory.')
if __name__=='__main__':main()
