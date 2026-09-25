import { useEffect, useRef, useState } from 'react';
import { MANIFEST } from '../cards/projectCards';
import { useStore } from '../store';
import { selectedTheme, switchTheme, validThemeColors } from '../theme';
import { applyPalette, paletteFromProject, parsePalette, type PalettePreset } from '../palettePresets';

const savedKey = `shotcraft:palettes:${MANIFEST?.name ?? 'default'}`;
type SavedPalette = {id:string;preset:PalettePreset};
const readSaved = ():SavedPalette[] => {
  try {
    const items:unknown=JSON.parse(localStorage.getItem(savedKey) ?? '[]');
    if(!Array.isArray(items))return [];
    return items.slice(0,50).flatMap(item=>{
      try{return typeof item?.id==='string' ? [{id:item.id,preset:parsePalette(JSON.stringify(item.preset),MANIFEST)}] : []}catch{return []}
    });
  }catch{return []}
};

const fields = [['page','背景'],['surface','卡片'],['text','文字'],['muted','次要文字'],['accent','强调色'],['field','浅色填充'],['border','边框']] as const;
const ColorField = ({label,value,onChange}: {label:string;value:string;onChange:(value:string,begin?:boolean)=>void}) => {
  const [draft,setDraft] = useState(value);
  const picker = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const endEdit = () => { editing.current = false; };
  useEffect(() => {
    // React onChange also fires for every native input event. Native change
    // marks the end of a picker gesture, even when the input retains focus.
    const input = picker.current!;
    input.addEventListener('change', endEdit);
    return () => input.removeEventListener('change', endEdit);
  }, []);
  useEffect(()=>setDraft(value),[value]);
  const valid = /^#[0-9a-f]{6}$/i.test(draft);
  const commit = () => { if(valid && draft !== value) onChange(draft); else setDraft(value); };
  return <label className="theme-color-row"><span>{label}</span>
    <input ref={picker} type="color" aria-label={`${label}取色`} value={value}
      onClick={endEdit} onBlur={endEdit}
      onKeyDown={e=>{if(!e.repeat && (e.key==='Enter' || e.key===' '))endEdit();}}
      onChange={e=>{onChange(e.target.value,!editing.current);editing.current=true;}} />
    <input type="text" aria-label={`${label}色值`} value={draft} maxLength={7} spellCheck={false}
      aria-invalid={!valid} onChange={e=>setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setDraft(value);}} />
  </label>;
};

export const ThemePanel = () => {
  const project = useStore(s=>s.project);
  const [saved,setSaved] = useState(readSaved);
  const [name,setName] = useState('');
  const [message,setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const colorHistory = useRef<ReturnType<typeof useStore.getState>["past"] | null>(null);
  const persist = (next:SavedPalette[]) => {
    try{localStorage.setItem(savedKey,JSON.stringify(next));setSaved(next);return true}
    catch{setMessage('保存失败：浏览器存储不可用，请导出配色备份。');return false}
  };
  const apply = (preset:PalettePreset) => {
    const s=useStore.getState();s.setPreview(null);s.setProject(applyPalette(s.project,preset));setName(preset.name);setMessage(`已应用「${preset.name}」`);
  };
  const themes = MANIFEST?.themes ?? [];
  const current = selectedTheme(MANIFEST,project.themeId);
  const custom = validThemeColors(MANIFEST,project.themeId,project.themeColors);
  const modified = Object.keys(custom).length > 0;
  const palette = {...current?.palette,...custom};
  const updateColor = (key:string,value:string,begin=true) => {
    const store = useStore.getState();
    const base = selectedTheme(MANIFEST,store.project.themeId)?.palette;
    const colors = validThemeColors(MANIFEST,store.project.themeId,store.project.themeColors);
    if(!base?.[key] || !/^#[0-9a-f]{6}$/i.test(value) || value.toLowerCase()===(colors[key] ?? base[key]).toLowerCase()) return;
    const next = {...colors,[key]:value};
    if(value.toLowerCase()===base[key].toLowerCase()) delete next[key];
    // Undo/redo or another edit ends the current gesture's history group.
    if(begin || colorHistory.current!==store.past) store.commit();
    store.setThemeColors(Object.keys(next).length ? next : undefined);
    colorHistory.current=useStore.getState().past;
  };
  return <section className="theme-panel" aria-label="影片主题">
    <div className="theme-panel-heading">预设主题</div>
    <p className="theme-panel-hint">选择一套风格，再调整配色。</p>
    {themes.length ? <div className="theme-options">{themes.map(theme=>{
      const active=theme.id===current?.id;
      const colors=theme.palette ?? {page:theme.background ?? '#f2eee6',text:'#13110f',accent:'#955905'};
      return <button key={theme.id} className={`theme-option${active?' active':''}`} aria-label={theme.label} aria-pressed={active}
        onClick={()=>{const store=useStore.getState();store.setPreview(null);if(!active)store.setProject(switchTheme(store.project,MANIFEST,theme.id));}}>
        <span className="theme-palette" aria-hidden="true">{[colors.page,colors.surface ?? colors.page,colors.accent].map((c,i)=><span key={i} style={{background:c}} />)}</span>
        <span className="theme-option-label"><strong>{theme.label.split(' · ')[0]}</strong><span>{active?'✓':''}</span></span>
      </button>;
    })}</div> : <p className="theme-panel-empty">当前工程尚未提供主题。</p>}
    {!!saved.length && <div className="saved-palettes"><div className="theme-panel-heading">我的主题</div>{saved.map(item=><div key={item.id} className="saved-palette">
      <button onClick={()=>apply(item.preset)} title={item.preset.name}><span style={{background:item.preset.colors.accent}} />{item.preset.name}</button>
      <button aria-label={`删除 ${item.preset.name}`} onClick={()=>{if(persist(saved.filter(p=>p.id!==item.id)))setMessage(`已删除「${item.preset.name}」`);}}>×</button>
    </div>)}</div>}
    <div className="theme-editor" aria-label="替换配色">
      <div className="theme-editor-heading"><span className="theme-panel-heading">替换配色</span><button className="theme-reset" disabled={!modified} onClick={()=>{const s=useStore.getState();s.setPreview(null);s.setProject({...s.project,themeColors:undefined});}}>恢复预设</button></div>
      <input className="palette-name" aria-label="配色名称" placeholder="配色名称（可选）" value={name} maxLength={60} onChange={e=>setName(e.target.value)} />
      <div className="palette-actions">
        <button className="btn" disabled={!current?.palette} onClick={()=>{
          if(saved.length>=50){setMessage('已保存 50 套配色，请先删除不再使用的主题。');return;}
          const preset=paletteFromProject(MANIFEST,useStore.getState().project,name);
          if(persist([...saved,{id:crypto.randomUUID(),preset}])){setName(preset.name);setMessage(`已保存「${preset.name}」，仅保存在此浏览器。`);}
        }}>保存配色</button>
        <button className="btn" onClick={()=>fileInput.current?.click()}>导入配色</button>
        <button className="btn" disabled={!current?.palette} onClick={()=>{
          const preset=paletteFromProject(MANIFEST,useStore.getState().project,name);
          const url=URL.createObjectURL(new Blob([JSON.stringify(preset,null,2)],{type:'application/json'}));
          const a=document.createElement('a');a.href=url;a.download=`${preset.name.replace(/[\\/:*?"<>|]/g,'-')}.palette.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
          setMessage('配色已导出为 JSON。');
        }}>导出配色</button>
      </div>
      <input ref={fileInput} type="file" hidden accept=".json,application/json" aria-label="导入配色文件" onChange={async e=>{
        const file=e.target.files?.[0];e.target.value='';if(!file)return;
        try{if(file.size>65536)throw Error('配色文件不能超过 64 KB。');apply(parsePalette(await file.text(),MANIFEST));setMessage('已导入并应用，点击「保存配色」可加入我的主题。');}
        catch(error){setMessage(error instanceof Error?error.message:'导入失败。');}
      }} />
      {!!message && <p className="theme-panel-hint" role="status">{message}</p>}
      {current?.palette ? <>
        <p className="theme-panel-hint">{modified?'已自定义 · ':'点击色块或输入 HEX · '}切换预设会重置配色</p>
        {fields.filter(([key])=>palette[key]).map(([key,label])=><ColorField key={`${current.id}:${key}`} label={label} value={palette[key]} onChange={(value,begin)=>updateColor(key,value,begin)} />)}
        <p className="theme-panel-note">同步预览与导出，可撤销。单独调整过的镜头颜色优先保留。</p>
      </> : <p className="theme-panel-note">{themes.length?'纸质主题保留原始截图质感。选择其他预设后，可调整整套配色。':'工程提供可编辑配色后，会在这里显示。'}</p>}
    </div>
  </section>;
};
