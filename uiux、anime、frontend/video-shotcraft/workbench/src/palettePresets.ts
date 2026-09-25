import type { WorkbenchManifest } from './cards/manifest';
import type { ProjectData } from './types';
import { selectedTheme, validThemeColors } from './theme';

export type PalettePreset = {format:'shotcraft-palette';version:1;name:string;baseThemeId:string;colors:Record<string,string>};
export const paletteFromProject = (m:WorkbenchManifest | null,p:ProjectData,name:string):PalettePreset => {
  const theme=selectedTheme(m,p.themeId);
  if(!theme?.palette)throw Error('请先选择支持配色的主题。');
  return {format:'shotcraft-palette',version:1,name:name.trim().slice(0,60)||`${theme.label.split(' · ')[0]} · 自定义`,baseThemeId:theme.id,colors:{...theme.palette,...validThemeColors(m,p.themeId,p.themeColors)}};
};
export const parsePalette = (text:string,m:WorkbenchManifest | null):PalettePreset => {
  if(text.length>65536)throw Error('配色文件过大，请选择小于 64 KB 的 JSON。');
  let value:unknown;
  try{value=JSON.parse(text)}catch{throw Error('文件不是有效的 JSON。')}
  if(!value||typeof value!=='object')throw Error('配色文件格式不正确。');
  const p=value as Partial<PalettePreset>;
  if(p.format!=='shotcraft-palette'||p.version!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>60)throw Error('请选择 ShotCraft 导出的配色 JSON（版本 1）。');
  const theme=m?.themes?.find(t=>t.id===p.baseThemeId);
  if(!theme?.palette)throw Error('当前工程不支持这份配色的基础主题。');
  if(!p.colors||typeof p.colors!=='object'||Array.isArray(p.colors))throw Error('配色缺少颜色字段。');
  const keys=Object.keys(theme.palette);
  if(Object.keys(p.colors).length!==keys.length||keys.some(k=>typeof p.colors?.[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(p.colors[k])))throw Error('颜色字段必须完整，并使用 #RRGGBB 格式。');
  return {format:'shotcraft-palette',version:1,name:p.name.trim(),baseThemeId:theme.id,colors:Object.fromEntries(keys.map(k=>[k,p.colors![k]]))};
};
export const applyPalette = (p:ProjectData,preset:PalettePreset):ProjectData => ({...p,themeId:preset.baseThemeId,themeColors:{...preset.colors}});
