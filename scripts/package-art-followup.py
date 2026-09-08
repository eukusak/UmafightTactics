"""Package approved generated art. Crop/resize/pad only; no background removal or fabricated animation."""
from pathlib import Path
from PIL import Image
import hashlib, io, json, zipfile, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]

def png(im):
    out=io.BytesIO(); im.save(out,format='PNG'); return out.getvalue()

def check(im):
    assert im.mode == 'RGBA'
    lo,hi=im.getchannel('A').getextrema(); assert lo==0 and hi>=250

# Manually inspected face windows in the generated cut-ins. Existing portraits are untouched.
boxes={
 'maruzensky':[865,0,1450,615],
 'daiwa_scarlet':[830,0,1510,710],
 'taiki_shuttle':[665,0,1325,700],
 'tm_opera_o':[770,0,1450,705],
 'mihono_bourbon':[720,0,1440,720],
}
invpath=ROOT/'src/data/manual/delivered-art.json'; inventory=set(json.loads(invpath.read_text()))
metadata={}
for id,box in boxes.items():
    source=ROOT/'docs/art-source/cutins'/f'{id}.png'
    im=Image.open(source);check(im)
    face=im.crop(box);face.thumbnail((244,244),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(256,256));out.paste(face,((256-face.width)//2,(256-face.height)//2))
    dest=ROOT/'public/assets/portraits'/f'{id}.png';dest.parent.mkdir(parents=True,exist_ok=True)
    assert not dest.exists(), f'Preserve existing {dest}'
    out.save(dest);inventory.add(f'portraits/{id}.png')
    metadata[id]={'source':str(source.relative_to(ROOT)), 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'crop':box,'size':[256,256],'method':'reviewed face crop from generated cut-in; alpha preserved'}
invpath.write_text(json.dumps(sorted(inventory),indent=2)+'\n')
(ROOT/'src/data/manual/portrait-crops.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')

# These are five independent SOURCE ART components, not an assembled/rigged model.
base=ROOT/'docs/art-source/rigging/special_week'
parts=[]
for i,id in enumerate(['head','torso','skirt','tail','hand']):
    source=base/'originals'/f'{id}.png';im=Image.open(source);check(im)
    box=im.getchannel('A').getbbox();piece=im.crop(box);piece.thumbnail((460,460),Image.Resampling.LANCZOS)
    dest=base/'parts'/f'{id}.png';dest.parent.mkdir(parents=True,exist_ok=True);piece.save(dest)
    x=(i%3)*512+(512-piece.width)//2;y=(i//3)*512+(512-piece.height)//2
    parts.append({'id':id,'source':str(source.relative_to(ROOT)),'file':str(dest.relative_to(base)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceCrop':list(box),'size':list(piece.size),'boardOffset':[x,y]})
canvas=Image.new('RGBA',(1536,1024))
xml=ET.Element('image',{'version':'0.0.3','w':'1536','h':'1024','name':'Special Week - PARTIAL unassembled source components'})
stack=ET.SubElement(xml,'stack')
with zipfile.ZipFile(base/'special_week_partial_source.ora','w') as z:
    z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
    for part in parts:
        im=Image.open(base/part['file']);x,y=part['boardOffset'];canvas.alpha_composite(im,(x,y))
        path=f'data/{part["id"]}.png';z.writestr(path,png(im))
        ET.SubElement(stack,'layer',{'name':part['id'],'src':path,'x':str(x),'y':str(y),'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
    z.writestr('stack.xml',ET.tostring(xml,encoding='utf-8',xml_declaration=True))
    z.writestr('mergedimage.png',png(canvas))
    thumb=canvas.copy();thumb.thumbnail((256,256));z.writestr('Thumbnails/thumbnail.png',png(thumb))
canvas.save(base/'parts-board.png')
(base/'parts.json').write_text(json.dumps({'status':'partial-source-art; unassembled; not-rigged; not-Cubism-import-ready','components':parts,'missing':['upper arms','forearms','legs','shoes','separate face/eyes/mouth','separate ears/hair','joint overlap alignment','assembled PSD','Cubism ArtMesh/deformers/parameters/physics/motions','cmo3/moc3/model3 export']},indent=2)+'\n')
print('Packaged 5 portraits and 5 independent source components; 0 rigged models.')
