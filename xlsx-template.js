(function(global){
  'use strict';

  const fromBase64=value=>{
    if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(value,'base64'));
    const raw=atob(value),out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out;
  };
  const xml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
  }[ch]));
  const column=n=>{let out='';for(;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
  const address=(row,col)=>`${column(col)}${row}`;

  function replaceCell(source,cell,value){
    const content=`<is><t xml:space="preserve">${xml(value)}</t></is>`;
    const target=new RegExp(`<c\\s+([^>]*\\br="${cell}"[^>]*?)(?:\\s*\\/\\s*>|>[\\s\\S]*?<\\/c>)`);
    const build=attrs=>`<c ${attrs.replace(/\s+t="[^"]*"/g,'')} t="inlineStr">${content}</c>`;
    if(target.test(source))return source.replace(target,(_,attrs)=>build(attrs));
    throw new Error(`Sel template ${cell} tidak ditemukan.`);
  }

  function trimSheet(source,count){
    const endRow=count*26;
    source=source.replace(/<dimension\b[^>]*\bref="[^"]*"/,`<dimension ref="B1:F${endRow}"`);
    source=source.replace(/<sheetData>([\s\S]*?)<\/sheetData>/,(_,body)=>{
      const rows=[...body.matchAll(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g)]
        .map(match=>match[0])
        .filter(row=>Number(row.match(/\br="(\d+)"/)?.[1]||0)<=endRow);
      return `<sheetData>${rows.join('')}</sheetData>`;
    });
    source=source.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{
      const merges=[...body.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"[^>]*\/>/g)]
        .filter(match=>Math.max(...[...match[1].matchAll(/\d+/g)].map(x=>Number(x[0])))<=endRow)
        .map(match=>match[0]);
      return `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>`;
    });
    source=source.replace(/<rowBreaks\b[^>]*>[\s\S]*?<\/rowBreaks>/g,'');
    const breaks=[];
    for(let id=53;id<=endRow;id+=52)breaks.push(`<brk id="${id}" man="true" max="16383" min="0"/>`);
    if(breaks.length){
      const block=`<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${breaks.join('')}</rowBreaks>`;
      source=source.replace(/<drawing\b/,`${block}<drawing`);
    }
    return source;
  }

  function trimDrawing(source,count){
    const endRow=count*26;
    return source.replace(/<xdr:(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:\1>/g,block=>{
      const fromRow=Number(block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1]||0);
      return fromRow<endRow?block:'';
    });
  }

  function trimWorkbook(source,count){
    return source.replace(/(&apos;Form Langsir&apos;!\$B\$1:\$F\$)\d+/,(_,prefix)=>`${prefix}${count*26}`);
  }

  class XlsxTemplate {
    constructor(templates){this.templates=templates||{};}
    formStart(index){return index===0?0:26*index+1;}
    fields(order,index){
      const values=new Map(),offset=this.formStart(index),set=(row,col,value)=>values.set(address(row+offset,col),value);
      let suffix='';
      if(order?.service_date){
        const d=new Date(`${order.service_date}T00:00:00`),roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
        suffix=`       /${roman[d.getMonth()]}/JAKK/${d.getFullYear()}`;
      }
      set(2,2,'NOMOR : '+suffix);
      let date='';
      if(order?.service_date){
        const p=order.service_date.split('-'),day=order.service_day||['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'][new Date(`${order.service_date}T00:00:00`).getDay()];
        date=`${day}, ${p[2]} / ${p[1]} / ${p[0]}`;
      }
      set(3,3,': '+date);set(4,3,': '+(order?.start_time||''));set(5,3,': '+(order?.end_time||''));
      [7,13].forEach((row,i)=>{
        const step=order?.steps?.[i]||{};
        set(row,2,step.train_code||'');set(row,3,step.from_track||'');set(row,4,step.to_track||'');set(row,5,step.movement||'');
        set(row,6,'Melalui sinyal langsir :'+(Object.keys(step).length?'\n'+(step.signals||''):'')+'\nwesel : '+(step.switches||''));
      });
      const columns={'SCHOWING':2,'PLR':3,'MAS':5,'PAP/PPKA':6};
      for(const [role,col] of Object.entries(columns)){
        const person=order?.staff?.[role]||{};
        set(24,col,'Nama : '+(person.name||''));set(25,col,'NIPP   : '+(person.nipp||''));
      }
      return values;
    }
    async export(orders){
      if(!global.JSZip)throw new Error('Mesin XLSX belum dimuat.');
      if(!orders.length||orders.length>23)throw new Error('Pilih 1 sampai 23 form.');
      const capacity=orders.length===1?1:orders.length<=4?4:orders.length<=10?10:23;
      const template=this.templates[String(capacity)];
      if(!template)throw new Error('Template Excel tidak tersedia.');
      const archive=await global.JSZip.loadAsync(fromBase64(template));
      const sheetFile=archive.file('xl/worksheets/sheet1.xml');
      if(!sheetFile)throw new Error('Worksheet template tidak ditemukan.');
      let sheet=trimSheet(await sheetFile.async('string'),orders.length);
      orders.forEach((order,index)=>{for(const [cell,value] of this.fields(order,index))sheet=replaceCell(sheet,cell,value);});
      archive.file('xl/worksheets/sheet1.xml',sheet);
      const drawingFile=archive.file('xl/drawings/drawing1.xml');
      if(drawingFile)archive.file('xl/drawings/drawing1.xml',trimDrawing(await drawingFile.async('string'),orders.length));
      const workbookFile=archive.file('xl/workbook.xml');
      if(workbookFile)archive.file('xl/workbook.xml',trimWorkbook(await workbookFile.async('string'),orders.length));
      return archive.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6},platform:'DOS'});
    }
  }

  global.XlsxTemplate=XlsxTemplate;
})(typeof window!=='undefined'?window:globalThis);
