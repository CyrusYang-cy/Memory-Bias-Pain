"""Standardize pain face height and position before grayscale luminance matching.
Run: python stimuli/normalize_pain_faces.py
Requires numpy and Pillow. Original color/alpha frames remain in pain_faces.
A fixed similarity transform per identity preserves proportions and temporal geometry.
"""
from pathlib import Path
import csv, hashlib, json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'pain_faces'
OUTPUT=ROOT/'pain_shine_rgba'
SIDE=1024
HEIGHT=760
TARGET_MEAN=0.12034558759979418
TARGET_SD=0.04278609626337459
L=np.arange(256)/255
LUT=np.where(L<=.04045,L/12.92,((L+.055)/1.055)**2.4)
def bounds(alpha):
    y,x=np.where(alpha>=128)
    return np.array([x.min(),y.min(),x.max()+1,y.max()+1],dtype=float)
def main():
    rows=[]; transforms=[]; prepared=[]
    for folder in sorted((SOURCE/'Pain').iterdir()):
        if not folder.is_dir():continue
        paths=sorted(folder.glob('*.png'),key=lambda f:int(f.stem))
        assert len(paths)==61
        boxes=np.array([bounds(np.array(Image.open(f).convert('RGBA'))[:,:,3]) for f in paths])
        assert np.all(boxes==boxes[0]), 'Changing source mask requires review'
        box=boxes[0];cx,cy=(box[:2]+box[2:])/2
        scale=HEIGHT/(box[3]-box[1]);tx=SIDE/2-scale*cx;ty=SIDE/2-scale*cy
        transforms.append(dict(identity=folder.name,source_bounds=box.tolist(),scale=scale,translate=[tx,ty]))
        for path in paths:
            im=Image.open(path).convert('RGBA')
            # Resample premultiplied colors to avoid dark halos at transparent edges.
            im=im.convert('RGBa').transform((SIDE,SIDE),Image.Transform.AFFINE,
                 (1/scale,0,-tx/scale,0,1/scale,-ty/scale),Image.Resampling.BICUBIC).convert('RGBA')
            a=np.array(im);mask=a[:,:,3]>0
            y=LUT[a[:,:,:3]]@np.array([.2126,.7152,.0722]);v=y[mask]
            unit=(v-v.mean())/v.std()
            prepared.append((path,a,unit))
    # A common SD must fit every frame without clipping.
    safe_sd=min([TARGET_SD]+[min(TARGET_MEAN/-u.min() if u.min()<0 else TARGET_SD,(1-TARGET_MEAN)/u.max() if u.max()>0 else TARGET_SD) for _,_,u in prepared])
    for path,a,u in prepared:
        mask=a[:,:,3]>0;v=TARGET_MEAN+safe_sd*u
        q=np.rint(255*np.where(v<=.0031308,v*12.92,1.055*np.maximum(v,0)**(1/2.4)-.055)).clip(0,255).astype('uint8')
        gray=np.zeros((SIDE,SIDE),dtype='uint8');gray[mask]=q
        result=np.dstack([gray,gray,gray,a[:,:,3]])
        dst=OUTPUT/'images'/path.relative_to(SOURCE);dst.parent.mkdir(parents=True,exist_ok=True)
        Image.fromarray(result).save(dst)
        saved=np.array(Image.open(dst));b=bounds(saved[:,:,3]);mean=float(LUT[saved[:,:,0]][mask].mean());sd=float(LUT[saved[:,:,0]][mask].std())
        assert abs(b[3]-b[1]-HEIGHT)<=2 and np.max(np.abs((b[:2]+b[2:])/2-SIDE/2))<=1
        assert not saved[0,:,3].any() and not saved[-1,:,3].any() and not saved[:,0,3].any() and not saved[:,-1,3].any()
        assert abs(mean-TARGET_MEAN)<.00015 and abs(sd-safe_sd)<.00015
        rows.append(dict(image=str(path.relative_to(SOURCE)),height=int(b[3]-b[1]),width=int(b[2]-b[0]),center_x=float((b[0]+b[2])/2),center_y=float((b[1]+b[3])/2),after_mean_Y=mean,after_std_Y=sd,source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),output_sha256=hashlib.sha256(dst.read_bytes()).hexdigest()))
    (OUTPUT/'metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
    with (OUTPUT/'metrics.csv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");w.writeheader();w.writerows(rows)
    summary=dict(images=len(rows),identities=len(transforms),canvas=[SIDE,SIDE],target_face_height=HEIGHT,center=[512,512],grayscale_all=True,feathered_transparency=True,transform_fixed_per_identity=True,target_mean_Y=TARGET_MEAN,target_std_Y=safe_sd,maximum_mean_error=max(abs(r['after_mean_Y']-TARGET_MEAN) for r in rows),maximum_sd_error=max(abs(r['after_std_Y']-safe_sd) for r in rows),height_range=[min(r['height'] for r in rows),max(r['height'] for r in rows)])
    (OUTPUT/'validation.json').write_text(json.dumps(summary,indent=2)+'\n')
    (OUTPUT/'run.json').write_text(json.dumps(dict(status='complete',pipeline='Original RGBA -> fixed aspect-preserving scale and centering -> linear Rec709 grayscale -> common affine mean/SD matching -> RGBA',metric_space='Uncomposited linear Rec.709 Y, binary ROI alpha >0',target_source='Original SHINIER validation mean/SD range midpoint',transforms=transforms),indent=2)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
