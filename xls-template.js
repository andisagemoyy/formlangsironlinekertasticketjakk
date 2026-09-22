(function(global){
  'use strict';
  const U8 = value => value instanceof Uint8Array ? value : new Uint8Array(value || 0);
  const join = (...parts) => {
    parts=parts.flat().map(U8); const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let at=0;
    for(const part of parts){out.set(part,at);at+=part.length;} return out;
  };
  const numbers = (bytes,values) => {const out=new Uint8Array(bytes*values.length),v=new DataView(out.buffer);values.forEach((n,i)=>bytes===2?v.setUint16(i*2,n&0xffff,true):v.setUint32(i*4,n>>>0,true));return out;};
  const v16=(...x)=>numbers(2,x),v32=(...x)=>numbers(4,x);
  const one=(...x)=>new Uint8Array(x.map(n=>n&255));
  const rec=(id,data)=>join(v16(id,data.length),data);
  const replace=(data,at,value)=>{const out=data.slice();out.set(value,at);return out;};
  const fromB64=value=>{if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(value,'base64'));const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;};
  const utf16=value=>{const out=new Uint8Array(value.length*2),v=new DataView(out.buffer);for(let i=0;i<value.length;i++)v.setUint16(i*2,value.charCodeAt(i),true);return out;};
  const pad=(data,size)=>{const out=new Uint8Array(size);out.set(data.slice(0,size));return out;};
  const textBytes=value=>{const out=new Uint8Array(value.length);for(let i=0;i<value.length;i++)out[i]=value.charCodeAt(i)&255;return out;};
  const read16=(data,at=0)=>new DataView(data.buffer,data.byteOffset,data.byteLength).getUint16(at,true);
  const read32=(data,at=0)=>new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(at,true);

  class XlsTemplate {
    constructor(template){
      this.t=template;this.strings=[...template.strings];this.stringIds=new Map(this.strings.map((s,i)=>[s,i]));this.references=0;
    }
    sid(value){if(!this.stringIds.has(value)){this.stringIds.set(value,this.strings.length);this.strings.push(value);}return this.stringIds.get(value);}
    formStart(index){return index===0?0:26*index+1;}
    style(row,col){
      const exact=this.t.styles[`${row},${col}`];if(exact!==undefined)return exact;
      let index=0;while(this.formStart(index+1)<=row)index++;
      return this.t.styles[`${row-this.formStart(index)},${col}`]??0;
    }
    shiftAnchors(data,rows){
      const parts=[];let p=0;
      while(p+8<=data.length){const ver=read16(data,p),type=read16(data,p+2),size=read32(data,p+4);let d=data.slice(p+8,p+8+size);p+=8+size;
        if((ver&15)===15)d=this.shiftAnchors(d,rows);
        else if(type===0xf010){d=replace(d,6,v16(read16(d,6)+rows));d=replace(d,14,v16(read16(d,14)+rows));}
        parts.push(v16(ver,type),v32(d.length),d);
      }
      if(p!==data.length)throw new Error('Struktur gambar templat tidak sesuai.');
      return join(parts);
    }
    records(formCount){
      const records=this.t.sheet_records.map(([id,b64])=>[id,fromB64(b64)]),existingForms=6;
      if(formCount>existingForms){
        const rowIds=new Set([0x208,0xfd,0xbe,0x201,0x203,0x27e,0x205,0x6]);
        const rowTemplate=records.filter(([id,d])=>rowIds.has(id)&&read16(d)>=131&&read16(d)<156);
        const rowCopies=[];for(let i=existingForms;i<formCount;i++){const shift=this.formStart(i)-131;for(const [id,d] of rowTemplate)rowCopies.push([id,replace(d,0,v16(read16(d)+shift))]);}
        const firstDrawing=records.findIndex(([id])=>id===0xec);records.splice(firstDrawing,0,...rowCopies);

        const drawingPairs=[];for(let i=0;i<records.length-1;i++)if(records[i][0]===0xec&&records[i+1][0]===0x5d)drawingPairs.push([records[i][1],records[i+1][1]]);
        const formDrawing=drawingPairs.slice(-4),extraDrawing=[];let nextObject=Math.max(...drawingPairs.map(([,d])=>read16(d,6)))+1,totalAdded=0;
        for(let i=existingForms;i<formCount;i++){const shift=this.formStart(i)-131;for(const [drawing,object] of formDrawing){const shifted=this.shiftAnchors(drawing,shift),obj=replace(object,6,v16(nextObject++));extraDrawing.push([0xec,shifted],[0x5d,obj]);totalAdded+=shifted.length;}}
        let lastObject=-1;for(let i=0;i<records.length;i++)if(records[i][0]===0x5d)lastObject=i;records.splice(lastObject+1,0,...extraDrawing);
        const first=records.findIndex(([id])=>id===0xec),head=records[first][1];let patched=replace(head,4,v32(read32(head,4)+totalAdded));patched=replace(patched,28,v32(read32(patched,28)+totalAdded));records[first][1]=patched;
      }
      const finalRow=formCount*26;
      for(const record of records){
        if(record[0]===0x200)record[1]=replace(record[1],4,v32(finalRow));
        if(record[0]===0xe5&&formCount>6){const d=record[1],count=read16(d),ranges=[];for(let i=0;i<count;i++)ranges.push(d.slice(2+i*8,10+i*8));const template=ranges.filter(x=>read16(x)>=131&&read16(x,2)<156);for(let n=6;n<formCount;n++){const shift=this.formStart(n)-131;for(const range of template){let x=replace(range,0,v16(read16(range)+shift));x=replace(x,2,v16(read16(range,2)+shift));ranges.push(x);}}record[1]=join(v16(ranges.length),ranges);}
      }
      return records;
    }
    fields(order,offset){
      const cells=new Map(),set=(r,c,v)=>cells.set(`${r-1+offset},${c-1}`,v);
      let suffix='';if(order?.service_date){const d=new Date(`${order.service_date}T00:00:00`),roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];suffix=`       /${roman[d.getMonth()]}/JAKK/${d.getFullYear()}`;}
      set(2,2,'NOMOR : '+suffix);
      let date='';if(order?.service_date){const p=order.service_date.split('-'),day=order.service_day||['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'][new Date(`${order.service_date}T00:00:00`).getDay()];date=`${day}, ${p[2]} / ${p[1]} / ${p[0]}`;}
      set(3,3,': '+date);set(4,3,': '+(order?.start_time||''));set(5,3,': '+(order?.end_time||''));
      [7,13].forEach((row,i)=>{const s=order?.steps?.[i]||{};set(row,2,s.train_code||'');set(row,3,s.from_track||'');set(row,4,s.to_track||'');set(row,5,s.movement||'');set(row,6,'Melalui sinyal langsir :'+(Object.keys(s).length?'\n'+(s.signals||''):'')+'\nwesel : '+(s.switches||''));});
      const columns={'SCHOWING':2,'PLR':3,'MAS':5,'PAP/PPKA':6};
      for(const [role,col] of Object.entries(columns)){const p=order?.staff?.[role]||{};set(24,col,'Nama : '+(p.name||''));set(25,col,'NIPP   : '+(p.nipp||''));}
      return cells;
    }
    drawing(data,page,shape,pages=0,pictureRefs=[],objectCount=24){
      const parts=[];let p=0,image=0;
      while(p+8<=data.length){let ver=read16(data,p),type=read16(data,p+2),size=read32(data,p+4),d=data.slice(p+8,p+8+size);p+=8+size;
        if((ver&15)===15)d=this.drawing(d,page,shape,pages,pictureRefs,objectCount);
        else if(type===0xf006&&pages){const shapeCount=objectCount+1,values=[pages*1024+shapeCount,pages+1,shapeCount*pages,pages];for(let i=1;i<=pages;i++)values.push(i,shapeCount);d=v32(...values);}
        else if(type===0xf007&&pages){image++;d=replace(d,24,v32(image===2?objectCount:(pictureRefs[image]||0)*pages));}
        else if(type===0xf008){ver=page<<4;d=v32(objectCount+1,page*1024+objectCount);}
        else if(type===0xf00a){d=join(v32(page*1024+shape.value++),d.slice(4));}
        parts.push(v16(ver,type),v32(d.length),d);
      }
      if(p!==data.length)throw new Error('Struktur gambar templat tidak sesuai.');
      return join(parts);
    }
    sheet(orders){
      const changes=new Map(),done=new Set(),parts=[],records=this.records(orders.length);orders.forEach((order,i)=>{for(const item of this.fields(order,this.formStart(i)))changes.set(...item);});
      let escher=join(records.filter(([id])=>id===0xec).map(([,d])=>d)),cursor=0,objectCount=records.filter(([id])=>id===0x5d).length;
      escher=this.drawing(escher,1,{value:0},0,[],objectCount);
      const write=key=>{const [r,c]=key.split(',').map(Number),style=this.style(r,c);parts.push(rec(0xfd,join(v16(r,c,style),v32(this.sid(changes.get(key))))));this.references++;done.add(key);};
      for(const [id,raw] of records){let d=raw;
        if(id===0x20b||id===0xd7)continue;
        if(id===0x208){const row=read16(d);for(const key of changes.keys())if(Number(key.split(',')[0])<row&&!done.has(key))write(key);}
        if(id===0xbe){const row=read16(d),first=read16(d,2),last=read16(d,d.length-2);for(let c=first;c<=last;c++){const key=`${row},${c}`;if(changes.has(key)){if(!done.has(key))write(key);}else parts.push(rec(0x201,join(v16(row,c),d.slice(4+2*(c-first),6+2*(c-first)))));}continue;}
        if([0xfd,0x201,0x203,0x27e,0x205,0x6].includes(id)){const key=`${read16(d)},${read16(d,2)}`;if(changes.has(key)){if(!done.has(key))write(key);continue;}}
        if(id===0xec){d=escher.slice(cursor,cursor+d.length);cursor+=d.length;}
        if(id===0xa1)d=replace(d,8,v16(0));
        if(id===0x23e){const flags=read16(d)&~0x600;d=replace(d,0,v16(flags|0x600));}
        if(id===0x0a){for(const key of changes.keys())if(!done.has(key))write(key);const breaks=[];for(let i=2;i<orders.length;i+=2)breaks.push(v16(this.formStart(i),1,5));if(breaks.length)parts.push(rec(0x1b,join(v16(breaks.length),breaks)));}
        if(id===0xfd)this.references++;
        parts.push(rec(id,d));
      }
      return join(parts);
    }
    sst(){
      const records=[];let id=0xfc,chunk=v32(this.references,this.strings.length);
      for(const s of this.strings){const u=utf16(s),entry=join(v16(u.length/2),one(1),u);if(entry.length>8224)throw new Error('Teks terlalu panjang untuk templat.');if(chunk.length+entry.length>8224){records.push(rec(id,chunk));id=0x3c;chunk=new Uint8Array();}chunk=join(chunk,entry);}
      records.push(rec(id,chunk));return join(records);
    }
    export(orders){
      if(!orders.length||orders.length>50)throw new Error('Ekspor membutuhkan 1–50 form.');
      const sheet=this.sheet(orders),objectCount=4*Math.max(orders.length,6),lastRow=orders.length*26-1;
      const globals=[];for(const [id,b64] of this.t.globals){let d=fromB64(b64);if(id===0x3d)d=replace(d,10,v16(0,0,1));globals.push(rec(id,d));}
      const tail=[];tail.push(rec(0x1ae,v16(1,0x401)));
      tail.push(rec(0x17,join(v16(1),v16(0,0,0))));
      const formula=join(one(0x3b),v16(0,0,lastRow,1,5)),name=join(v16(0x20),one(0,1),v16(formula.length,0,1),one(0,0,0,0,0,6),formula);tail.push(rec(0x18,name));
      const draw=this.drawing(fromB64(this.t.drawing_group),0,{value:0},1,this.t.picture_refs,objectCount);
      for(let i=0;i<draw.length;i+=8224)tail.push(rec(i?0x3c:0xeb,draw.slice(i,i+8224)));
      tail.push(this.sst(),rec(0x0a,new Uint8Array()));
      const globalBytes=join(globals),tailBytes=join(tail),sheetName='Form Langsir',bound=join(v32(0),one(0,0,sheetName.length,0),textBytes(sheetName));
      const pos=globalBytes.length+tailBytes.length+bound.length+4,boundBytes=rec(0x85,join(v32(pos),bound.slice(4)));
      return this.compound(join(globalBytes,boundBytes,tailBytes,sheet));
    }
    compound(stream){
      const size=Math.max(4096,stream.length),n=Math.ceil(size/512);let f=1;while(Math.ceil((n+1+f)/128)>f)f++;if(f>109)throw new Error('Ukuran ekspor melebihi batas.');
      let header=new Uint8Array(512);header.set(new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]),0);header.set(v16(0x3e,3,0xfffe,9,6),24);header.set(v32(f,n,0,4096,0xfffffffe,0,0xfffffffe,0),44);
      const difat=[];for(let i=0;i<109;i++)difat.push(i<f?n+1+i:0xffffffff);header.set(v32(...difat),76);
      const entry=(name,type,child,start,length)=>{const label=join(utf16(name),v16(0));return join(pad(label,64),v16(label.length),one(type,1),v32(0xffffffff,0xffffffff,child),new Uint8Array(36),v32(start,length,0));};
      const directory=pad(join(entry('Root Entry',5,1,0xfffffffe,0),entry('Workbook',2,0xffffffff,0,size)),512),fat=[];
      for(let i=0;i<f*128;i++)fat.push(i<n?(i===n-1?0xfffffffe:i+1):(i===n?0xfffffffe:(i<=n+f?0xfffffffd:0xffffffff)));
      return join(header,pad(stream,n*512),directory,v32(...fat));
    }
  }
  global.XlsTemplate=XlsTemplate;
})(typeof window!=='undefined'?window:globalThis);
