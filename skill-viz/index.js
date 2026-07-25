#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TEXT_EXTENSIONS = new Set(['.md','.txt','.py','.js','.ts','.tsx','.jsx','.json','.yaml','.yml','.toml','.sh','.bash','.zsh','.css','.html','.xml','.csv','.sql']);

function slugify(value) {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

function readText(file, maxBytes = 250_000) {
  try {
    const st = fs.statSync(file);
    if (st.size > maxBytes) return { content: `[file omitted: larger than ${maxBytes.toLocaleString()} bytes]`, kind: 'text' };
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) return { content: '[binary file]', kind: 'binary' };
    return { content: buf.toString('utf8'), kind: 'text' };
  } catch (err) {
    return { content: `[could not read file: ${err.message}]`, kind: 'error' };
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return [{}, text];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [{}, text];
  const fm = text.slice(3, end).trim().split(/\r?\n/);
  const body = text.slice(end + 4).trim();
  const meta = {};
  for (let i = 0; i < fm.length;) {
    const line = fm[i];
    if (!line.trim() || line.trimStart().startsWith('#') || !line.includes(':')) { i++; continue; }
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    let raw = line.slice(idx + 1).trim();
    if (['|','>','|-','>-','|+','>+'].includes(raw)) {
      const style = raw[0];
      const block = [];
      i++;
      while (i < fm.length) {
        const nxt = fm[i];
        if (nxt.trim() && !nxt.startsWith(' ') && !nxt.startsWith('\t') && nxt.includes(':')) break;
        block.push(nxt); i++;
      }
      const indents = block.filter(x => x.trim()).map(x => x.length - x.trimStart().length);
      const trim = indents.length ? Math.min(...indents) : 0;
      const cleaned = block.map(x => x.slice(trim));
      meta[key] = style === '>' ? cleaned.map(x => x.trim()).filter(Boolean).join(' ') : cleaned.join('\n').trim();
      continue;
    }
    meta[key] = raw.replace(/^['"]|['"]$/g, '');
    i++;
  }
  return [meta, body];
}

function markdownToHtml(md) {
  md = String(md || '').replace(/\r\n/g, '\n');
  const codeBlocks = [];
  md = md.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="language-${escapeHtml((lang || '').trim())}">${highlightCode(code, lang)}</code></pre>`);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });
  const out = [];
  let paragraph = [];
  let inUl = false;
  let inOl = false;
  const inline = text => escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
  const closeLists = () => { if (inUl) { out.push('</ul>'); inUl = false; } if (inOl) { out.push('</ol>'); inOl = false; } };
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (!stripped) { flushParagraph(); closeLists(); continue; }
    if (stripped.startsWith('\u0000CODE')) { flushParagraph(); closeLists(); out.push(stripped); continue; }
    if (isTableStart(lines, i)) {
      flushParagraph(); closeLists();
      const table = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { table.push(lines[i]); i++; }
      i--;
      out.push(tableToHtml(table, inline));
      continue;
    }
    const h = stripped.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushParagraph(); closeLists(); const level = h[1].length; out.push(`<h${level} id="${slugify(h[2])}">${inline(h[2])}</h${level}>`); continue; }
    const ul = stripped.match(/^[-*]\s+(.+)$/);
    if (ul) { flushParagraph(); if (inOl) { out.push('</ol>'); inOl = false; } if (!inUl) { out.push('<ul>'); inUl = true; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    const ol = stripped.match(/^\d+\.\s+(.+)$/);
    if (ol) { flushParagraph(); if (inUl) { out.push('</ul>'); inUl = false; } if (!inOl) { out.push('<ol>'); inOl = true; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    if (stripped.startsWith('>')) { flushParagraph(); closeLists(); out.push(`<blockquote>${inline(stripped.replace(/^>\s*/, ''))}</blockquote>`); continue; }
    paragraph.push(stripped);
  }
  flushParagraph(); closeLists();
  let rendered = out.join('\n');
  codeBlocks.forEach((block, i) => { rendered = rendered.replace(`\u0000CODE${i}\u0000`, block); });
  return rendered;
}

function splitTableRow(row) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isTableStart(lines, i) {
  return i + 1 < lines.length && lines[i].includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1]);
}

function tableToHtml(lines, inline) {
  const headers = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);
  return '<div class="table-wrap"><table><thead><tr>' + headers.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + headers.map((_, i) => `<td>${inline(row[i] || '')}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
}

function highlightCode(code, lang = '') {
  let html = escapeHtml(code);
  const l = String(lang || '').trim().toLowerCase();
  html = html.replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, '<span class="tok-str">$1</span>');
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  html = html.replace(/(\/\/.*|#.*)$/gm, '<span class="tok-comment">$1</span>');
  if (['js','javascript','ts','typescript','jsx','tsx'].includes(l)) html = html.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|try|catch|await|async|true|false|null|undefined)\b/g, '<span class="tok-key">$1</span>');
  else if (['py','python'].includes(l)) html = html.replace(/\b(def|return|if|elif|else|for|while|import|from|class|try|except|with|as|async|await|True|False|None)\b/g, '<span class="tok-key">$1</span>');
  else if (['sh','bash','zsh','shell'].includes(l)) html = html.replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|export|local)\b/g, '<span class="tok-key">$1</span>');
  else html = html.replace(/\b(true|false|null|undefined)\b/g, '<span class="tok-key">$1</span>');
  return html;
}

function languageFor(file) {
  const ext = path.extname(file).toLowerCase().slice(1);
  return ({ py:'python', js:'javascript', ts:'typescript', sh:'bash', yml:'yaml' })[ext] || ext;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = current => {
    for (const name of fs.readdirSync(current).sort()) {
      const p = path.join(current, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) results.push(p);
    }
  };
  walk(dir);
  return results;
}

function walkDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = current => {
    results.push(current);
    for (const name of fs.readdirSync(current).sort()) {
      const p = path.join(current, name);
      try {
        if (fs.statSync(p).isDirectory()) walk(p);
      } catch {}
    }
  };
  walk(dir);
  return results;
}

function collectFiles(dir) {
  return walkFiles(dir).map(file => {
    const rel = path.relative(dir, file).split(path.sep).join('/');
    const st = fs.statSync(file);
    const ext = path.extname(file).toLowerCase();
    const { content, kind } = (TEXT_EXTENSIONS.has(ext) || st.size < 80_000) ? readText(file) : { content: '[binary file]', kind: 'binary' };
    return { name: rel, path: file, kind, language: languageFor(file), content };
  });
}

function discoverIn(base, group, agent = 'common') {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).sort().flatMap(entry => {
    const skillDir = path.join(base, entry);
    const skillMd = path.join(skillDir, 'SKILL.md');
    const linkStat = fs.lstatSync(skillDir);
    const isSymlink = linkStat.isSymbolicLink();
    let symlinkTarget = '';
    if (isSymlink) {
      try { symlinkTarget = fs.realpathSync(skillDir); } catch { return []; }
    }
    if (!fs.existsSync(skillMd) || !fs.statSync(skillDir).isDirectory()) return [];
    const raw = fs.readFileSync(skillMd, 'utf8');
    const [meta, body] = parseFrontmatter(raw);
    const assetsDir = path.join(skillDir, 'assets');
    const assets = walkFiles(assetsDir).map(p => path.relative(assetsDir, p).split(path.sep).join('/')).sort();
    return [{
      id: slugify(`${group}-${entry}`),
      name: meta.name || entry,
      description: meta.description || '',
      group,
      agent,
      path: skillDir,
      is_symlink: isSymlink,
      symlink_target: symlinkTarget,
      body_markdown: body,
      body_html: markdownToHtml(body),
      scripts: collectFiles(path.join(skillDir, 'scripts')),
      references: collectFiles(path.join(skillDir, 'references')),
      assets,
    }];
  });
}

const AGENT_USES_COMMON = {
  pi: true,
  codex: true,
  antigravity: true,
};

const AGENT_PROFILES = {
  common: root => [
    ['Common workspace .agents', path.join(root, '.agents', 'skills')],
    ['Common global .agents', path.join(os.homedir(), '.agents', 'skills')],
    ['Common config agents', path.join(os.homedir(), '.config', 'agents', 'skills')],
  ],
  pi: root => [
    ['Pi workspace', path.join(root, '.pi', 'agent', 'skills')],
    ['Pi global', path.join(os.homedir(), '.pi', 'agent', 'skills')],
  ],
  claude: root => [
    ['Claude Code workspace', path.join(root, '.claude', 'skills')],
    ['Claude Code global', path.join(os.homedir(), '.claude', 'skills')],
    ['Claude plugin cache', path.join(os.homedir(), '.claude', 'plugins', 'cache', 'skills')],
    ['Claude marketplace skills', path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'skills')],
  ],
  codex: root => [
    ['Codex workspace', path.join(root, '.codex', 'skills')],
    ['Codex global', path.join(os.homedir(), '.codex', 'skills')],
    ['Codex system', path.join(os.homedir(), '.codex', 'skills', '.system')],
    ['Codex vendor imports', path.join(os.homedir(), '.codex', 'vendor_imports', 'skills', 'skills')],
  ],
  antigravity: root => [
    ['Antigravity global', path.join(os.homedir(), '.gemini', 'config', 'skills')],
    ['Antigravity legacy global', path.join(os.homedir(), '.gemini', 'antigravity', 'global_skills')],
    ['Antigravity legacy IDE global', path.join(os.homedir(), '.gemini', 'antigravity-ide', 'global_skills')],
    ['Antigravity legacy backup global', path.join(os.homedir(), '.gemini', 'antigravity-backup', 'global_skills')],
    ['Antigravity legacy workspace', path.join(root, '.agent', 'skills')],
  ],
  copilot: root => [
    ['Copilot workspace', path.join(root, '.copilot', 'skills')],
    ['Copilot global', path.join(os.homedir(), '.copilot', 'skills')],
  ],
  mavis: root => [
    ['Mavis global', path.join(os.homedir(), '.mavis', 'skills')],
    ['Mavis built-in', path.join(os.homedir(), '.mavis', '.builtin-skills')],
    ['Mavis main skills', path.join(os.homedir(), '.mavis', 'agents', 'main', 'skills')],
    ['Mavis main built-in', path.join(os.homedir(), '.mavis', 'agents', 'main', '.builtin-skills')],
  ],
  minimax: root => [
    ['MiniMax global', path.join(os.homedir(), '.minimaxagent', 'skills')],
    ['MiniMax OpenClaw', path.join(os.homedir(), '.openclaw', '.minimax', 'skills')],
    ['MiniMax project', path.join(root, '.minimax', 'skills')],
  ],
  hermes: root => [
    ['Hermes global', path.join(os.homedir(), '.hermes', 'skills')],
    ['Hermes agent skills', path.join(os.homedir(), '.hermes', 'hermes-agent', 'skills')],
    ['Hermes workspace', path.join(root, '.hermes', 'skills')],
  ],
};

function defaultSources(root, agents = ['all']) {
  const selected = agents.includes('all') ? Object.keys(AGENT_PROFILES) : agents.filter(agent => agent !== 'custom');
  const candidates = [];
  for (const agent of selected) {
    const profile = AGENT_PROFILES[agent];
    if (!profile) throw new Error(`Unknown agent profile: ${agent}. Known agents: all, ${Object.keys(AGENT_PROFILES).join(', ')}`);
    candidates.push(...profile(root).map(([label, p]) => [label, p, agent]));
  }
  const seen = new Set();
  const unique = [];
  for (const [label, p, agent] of candidates) {
    const key = `${agent}:${label}:${fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([label, p, agent]);
  }
  return unique;
}

function normalizeAgents(agents = ['all']) {
  return agents.includes('all') ? Object.keys(AGENT_PROFILES) : agents;
}

function buildHtml(skills, sources, selectedAgents = Object.keys(AGENT_PROFILES)) {
  const agentNames = [...new Set(sources.map(([, , agent]) => agent))];
  const payload = JSON.stringify({ skills, selected_agents: selectedAgents, agents: agentNames, common_by_agent: AGENT_USES_COMMON }).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const sourcesHtml = sources.map(([label, p, agent]) => `<li data-agent="${escapeHtml(agent)}"><code>${escapeHtml(label)}</code>: ${escapeHtml(p)}</li>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill Visualizer</title>
<style>
:root{--bg:#f8fafc;--surface:#ffffff;--surface-2:#f1f5f9;--text:#0f172a;--muted:#64748b;--brand:#18181b;--brand-fg:#fafafa;--line:#e2e8f0;--code:#f8fafc;--ring:rgba(15,23,42,.12);--shadow:0 1px 2px rgba(15,23,42,.05)}
:root[data-theme="dark"]{--bg:#09090b;--surface:#0f0f12;--surface-2:#18181b;--text:#fafafa;--muted:#a1a1aa;--brand:#fafafa;--brand-fg:#09090b;--line:#27272a;--code:#09090b;--ring:rgba(250,250,250,.12);--shadow:0 1px 2px rgba(0,0,0,.35)}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased}
.app{display:grid;grid-template-columns:320px 280px 1fr;height:100vh} aside{background:var(--surface);border-right:1px solid var(--line);padding:20px;overflow:auto} main{overflow:auto;padding:32px}.mobile-app-title{display:none}.mobile-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.collapse-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.collapse-btn{display:none;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:4px;width:30px;height:30px;cursor:pointer}.collapse-btn:hover{background:var(--surface-2);color:var(--text)}.toc-sidebar{background:var(--bg);padding:16px}.toc-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:2px 0 12px}.toc-section{border-bottom:1px solid var(--line);padding:6px 0}.toc-section summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;padding:8px 0;font-size:13px;font-weight:700}.toc-section summary::-webkit-details-marker{display:none}.toc-section summary::after{content:'+';color:var(--muted);font-weight:500}.toc-section[open] summary::after{content:'−'}.toc-link{display:block;width:100%;border:0;background:transparent;color:var(--muted);text-align:left;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.toc-link:hover{background:var(--surface-2);color:var(--text)}.toc-link.lvl-2{padding-left:18px}.toc-link.lvl-3{padding-left:28px}.toc-link.lvl-4,.toc-link.lvl-5,.toc-link.lvl-6{padding-left:38px}
.sidebar-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.icon-btn{border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:4px;cursor:pointer;box-shadow:var(--shadow);width:36px;height:36px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center}.icon-btn:hover{background:var(--surface-2)}.icon-btn svg{width:16px;height:16px;stroke-width:2}
h1{font-size:20px;letter-spacing:-.025em;margin:0 0 6px} .subtitle{color:var(--muted);font-size:13px;line-height:1.45} .search{width:100%;margin:20px 0 14px;padding:10px 12px;border-radius:4px;border:1px solid var(--line);background:var(--surface);color:var(--text);outline:none;box-shadow:var(--shadow)} .search:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}
.group{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 8px} .skill-btn{width:100%;border:1px solid transparent;background:transparent;color:var(--text);text-align:left;padding:10px 11px;border-radius:4px;cursor:pointer;margin:2px 0;transition:background .15s,border-color .15s}
.skill-btn:hover{background:var(--surface-2)} .skill-btn.active{background:var(--text);border-color:var(--text);color:var(--bg)} .skill-btn strong{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;min-width:0} .skill-btn span{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px} .skill-btn.active span{color:color-mix(in srgb,var(--bg) 72%,transparent)} .symlink-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:var(--muted)} .symlink-icon svg{width:13px;height:13px;stroke-width:2} .skill-btn.active .symlink-icon{color:var(--bg)} h2{display:flex;align-items:center;gap:8px} h2 .symlink-icon{color:var(--muted)} h2 .symlink-icon svg{width:16px;height:16px} .symlink-icon::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%) translateY(2px);background:var(--text);color:var(--bg);border:1px solid var(--line);padding:4px 7px;font:500 12px/1 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s,transform .12s;z-index:20;box-shadow:var(--shadow)} .symlink-icon::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:var(--text);opacity:0;pointer-events:none;transition:opacity .12s;z-index:21} .symlink-icon:hover::after,.symlink-icon:focus::after,.symlink-icon:hover::before,.symlink-icon:focus::before{opacity:1;transform:translateX(-50%) translateY(0)}
.card{max-width:1080px;margin:0 auto;background:var(--surface);border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow);padding:32px}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 0;padding-top:20px;border-top:1px solid var(--line)} .pill{font-size:12px;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:6px 9px}
.path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);word-break:break-all;font-size:12px} h2{font-size:30px;letter-spacing:-.04em;margin:0 0 8px} h3{margin-top:28px;color:var(--text);letter-spacing:-.02em} a{color:var(--text);text-underline-offset:3px} p,li{font-size:14px;line-height:1.65} blockquote{border-left:3px solid var(--line);padding-left:14px;color:var(--muted);margin-left:0}
pre{background:var(--code);border:1px solid var(--line);border-radius:4px;padding:16px;overflow:auto;font-size:13px;line-height:1.55} code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace} :not(pre)>code{background:var(--surface-2);border:1px solid var(--line);padding:2px 5px;border-radius:3px;font-size:.92em}.table-wrap{overflow:auto;margin:16px 0;border:1px solid var(--line);border-radius:4px} table{width:100%;border-collapse:collapse;font-size:13px} th,td{padding:9px 11px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top} th{background:var(--surface-2);font-weight:700} tr:last-child td{border-bottom:0}.tok-key{color:#7c3aed}.tok-str{color:#047857}.tok-num{color:#2563eb}.tok-comment{color:var(--muted);font-style:italic}:root[data-theme="dark"] .tok-key{color:#c084fc}:root[data-theme="dark"] .tok-str{color:#86efac}:root[data-theme="dark"] .tok-num{color:#93c5fd}
.content-section{scroll-margin-top:24px}.file-box{margin:0 0 14px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--surface);scroll-margin-top:24px}
.file-header{padding:11px 13px;background:var(--surface-2);border-bottom:1px solid var(--line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text);font-size:12px} .file-box pre{border:0;border-radius:0;margin:0;max-height:620px} .resource-label{margin:24px 0 12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
.empty{text-align:center;color:var(--muted);padding:80px 20px} .sources{font-size:12px;color:var(--muted);padding-left:18px;line-height:1.6} .sources li.hidden{display:none}.count{color:var(--muted);font-size:12px;margin-top:12px}.agent-filter{margin:18px 0 4px}.agent-select{width:100%;padding:12px 10px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;line-height:1.25;outline:none}.agent-select:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}
@media (max-width: 980px){body{height:100vh;overflow:hidden;display:flex;flex-direction:column}.mobile-app-title{display:block;flex:0 0 auto;z-index:40;background:var(--surface);border-bottom:1px solid var(--line);padding:14px 18px}.mobile-app-title h1{margin:0}.mobile-app-title .subtitle{margin-top:4px}.app{display:flex;flex-direction:column;flex:1;min-height:0;height:auto;overflow:hidden}.collapse-btn{display:inline-flex;align-items:center;justify-content:center}.skills-sidebar,.toc-sidebar{flex:0 0 auto;max-height:34vh;border-right:0;border-bottom:1px solid var(--line);padding:0;overflow:auto}.toc-sidebar{background:var(--surface)}.collapse-row{position:sticky;top:0;z-index:10;background:var(--surface);padding:14px 18px;border-bottom:1px solid var(--line)}.toc-sidebar .collapse-row{background:var(--surface)}.sidebar-body,#toc{padding:14px 18px}.skills-sidebar.collapsed,.toc-sidebar.collapsed{max-height:none;overflow:hidden}.skills-sidebar.collapsed .collapse-row,.toc-sidebar.collapsed .collapse-row{border-bottom:0}.skills-sidebar.collapsed .sidebar-body,.toc-sidebar.collapsed #toc{display:none}.skills-sidebar .sidebar-head{display:none} main{flex:1;min-height:0;padding:18px;overflow:auto}.card{padding:22px;border-radius:4px}}
</style></head><body><div class="mobile-app-title"><div class="mobile-title-row"><div><h1>Skill Visualizer</h1><div class="subtitle">Standalone dashboard for workspace and global agent skills.</div></div><button class="icon-btn theme-toggle" type="button" aria-label="Toggle theme"></button></div></div><div class="app" id="app"><aside class="skills-sidebar" id="skills-sidebar"><div class="collapse-row"><div><div class="sidebar-head"><div><h1>Skill Visualizer</h1><div class="subtitle">Standalone dashboard for workspace and global agent skills.</div></div><button class="icon-btn theme-toggle" type="button" aria-label="Toggle theme"></button></div><div class="toc-title">Available Skills</div></div><button id="skills-toggle" class="collapse-btn" type="button" aria-label="Toggle skills sidebar">−</button></div><div class="sidebar-body"><div class="agent-filter"><div class="toc-title">Agents</div><div id="agent-list"></div></div><input id="q" class="search" placeholder="Search skills, scripts, references…"><div id="list"></div><div class="count" id="count"></div><h3>Checked sources</h3><ul class="sources" id="sources">${sourcesHtml}</ul></div></aside><aside class="toc-sidebar" id="toc-sidebar"><div class="collapse-row"><div class="toc-title">Contents</div><button id="toc-toggle" class="collapse-btn" type="button" aria-label="Toggle contents sidebar">−</button></div><div id="toc"></div></aside><main id="main"><div id="detail" class="card"></div></main></div>
<script type="application/json" id="data">${payload}</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const skills = DATA.skills;
let selectedAgents = new Set(DATA.selected_agents || DATA.agents || []);
let active = visibleSkills()[0]?.id || null;
const app = document.getElementById('app'), skillsSidebar = document.getElementById('skills-sidebar'), tocSidebar = document.getElementById('toc-sidebar'), skillsToggle = document.getElementById('skills-toggle'), tocToggle = document.getElementById('toc-toggle'), list = document.getElementById('list'), detail = document.getElementById('detail'), q = document.getElementById('q'), count = document.getElementById('count'), toc = document.getElementById('toc'), main = document.getElementById('main'), agentList = document.getElementById('agent-list'), sourcesEl = document.getElementById('sources'), themeToggles = [...document.querySelectorAll('.theme-toggle')];
const savedTheme = localStorage.getItem('skill-visualizer-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = savedTheme;
const sunIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
const moonIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>';
function syncThemeButtons(){const dark=document.documentElement.dataset.theme === 'dark'; themeToggles.forEach(btn=>{btn.innerHTML=dark?sunIcon:moonIcon; btn.title=dark?'Switch to light mode':'Switch to dark mode';})}
syncThemeButtons();
themeToggles.forEach(btn=>btn.onclick = () => {const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem('skill-visualizer-theme', next); syncThemeButtons();});
function setCollapsed(which, collapsed){const sidebar=which==='skills'?skillsSidebar:tocSidebar; const cls=which==='skills'?'skills-collapsed':'toc-collapsed'; const btn=which==='skills'?skillsToggle:tocToggle; sidebar.classList.toggle('collapsed',collapsed); app.classList.toggle(cls,collapsed); btn.textContent=collapsed?'+':'−'; localStorage.setItem('skill-visualizer-'+which+'-collapsed', collapsed?'1':'0');}
skillsToggle.onclick=()=>setCollapsed('skills',!skillsSidebar.classList.contains('collapsed'));
tocToggle.onclick=()=>setCollapsed('toc',!tocSidebar.classList.contains('collapsed'));
setCollapsed('skills',localStorage.getItem('skill-visualizer-skills-collapsed')==='1');
setCollapsed('toc',localStorage.getItem('skill-visualizer-toc-collapsed')==='1');
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function searchable(s){return [s.name,s.description,s.group,s.agent,s.path,s.is_symlink?'symlink':'',s.symlink_target,s.body_markdown,...s.scripts.map(f=>f.name+' '+f.content),...s.references.map(f=>f.name+' '+f.content),...s.assets].join(' ').toLowerCase()}
function symlinkIcon(){return '<span class="symlink-icon" data-tooltip="symlink" aria-label="symlink" tabindex="0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>'}
function highlightCode(code,lang=''){let html=esc(code); const l=String(lang||'').trim().toLowerCase(); html=html.replace(/(&quot;.*?&quot;|'.*?')/g,'<span class="tok-str">$1</span>'); html=html.replace(/\\b(\\d+(?:\\.\\d+)?)\\b/g,'<span class="tok-num">$1</span>'); html=html.replace(/(\\/\\/.*|#.*)$/gm,'<span class="tok-comment">$1</span>'); if(['js','javascript','ts','typescript','jsx','tsx'].includes(l)) html=html.replace(/\\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|try|catch|await|async|true|false|null|undefined)\\b/g,'<span class="tok-key">$1</span>'); else if(['py','python'].includes(l)) html=html.replace(/\\b(def|return|if|elif|else|for|while|import|from|class|try|except|with|as|async|await|True|False|None)\\b/g,'<span class="tok-key">$1</span>'); else if(['sh','bash','zsh','shell'].includes(l)) html=html.replace(/\\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|export|local)\\b/g,'<span class="tok-key">$1</span>'); else html=html.replace(/\\b(true|false|null|undefined)\\b/g,'<span class="tok-key">$1</span>'); return html}
function renderAgentFilter(){const current=[...selectedAgents][0] || (DATA.agents||[])[0]; agentList.innerHTML='<select class="agent-select" aria-label="Agent profile">'+(DATA.agents||[]).map(a=>'<option value="'+esc(a)+'" '+(a===current?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select>'; agentList.querySelector('select').onchange=e=>{selectedAgents=new Set([e.target.value]); const visible=skills.filter(s=>selectedAgents.has(s.agent)); active=visible[0]?.id; render();};}
function activeAgentSet(){const selected=[...selectedAgents][0]; const set=new Set(selected?[selected]:[]); if(DATA.common_by_agent && DATA.common_by_agent[selected]) set.add('common'); return set;}
function renderSources(){const agents=activeAgentSet(); sourcesEl.querySelectorAll('li').forEach(li=>li.classList.toggle('hidden',!agents.has(li.dataset.agent)));}
function visibleSkills(){const agents=activeAgentSet(); return skills.filter(s=>agents.has(s.agent));}
function renderList(){renderSources(); const term=q.value.toLowerCase().trim(); const shown=visibleSkills().filter(s=>!term||searchable(s).includes(term)); const groups=[...new Set(shown.map(s=>s.group))]; list.innerHTML=groups.map(g=>'<div class="group">'+esc(g)+'</div>'+shown.filter(s=>s.group===g).map(s=>'<button class="skill-btn '+(s.id===active?'active':'')+'" data-id="'+esc(s.id)+'"><strong>'+esc(s.name)+(s.is_symlink?symlinkIcon():'')+'</strong><span>'+esc(s.description)+'</span></button>').join('')).join('') || '<div class="empty">No matching skills</div>'; count.textContent=shown.length+' skill'+(shown.length===1?'':'s')+' found'; list.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=b.dataset.id; render();})}
function fileBox(f,id){return '<div class="file-box" id="'+esc(id)+'"><div class="file-header">'+esc(f.name)+' <span class="path">'+esc(f.path)+'</span></div><pre><code class="language-'+esc(f.language)+'">'+highlightCode(f.content,f.language)+'</code></pre></div>'}
function resources(s){let html=''; if(s.references.length){html += '<div class="resource-label" id="references">References</div>' + s.references.map((f,i)=>fileBox(f,'reference-'+i)).join('')} if(s.assets.length){html += '<div class="resource-label" id="assets">Assets</div><ul>' + s.assets.map((a,i)=>'<li id="asset-'+i+'"><code>'+esc(a)+'</code></li>').join('') + '</ul>'} return html || '<p class="path">No resources found for this skill.</p>'}
function scrollToId(id){const el=document.getElementById(id); if(el) main.scrollTo({top:el.offsetTop-18,behavior:'smooth'});}
function tocLink(label,id,lvl){return '<button class="toc-link lvl-'+lvl+'" data-target="'+esc(id)+'">'+esc(label)+'</button>'}
function buildToc(s){const skillLinks=[tocLink('Overview','skill-md',1)]+[...detail.querySelectorAll('#skill-md h1,#skill-md h2,#skill-md h3,#skill-md h4,#skill-md h5,#skill-md h6')].map(h=>tocLink(h.textContent,h.id,Number(h.tagName.slice(1)))).join(''); const scriptLinks=s.scripts.length?s.scripts.map((f,i)=>tocLink(f.name,'script-'+i,1)).join(''):'<div class="path">No scripts</div>'; let resourceLinks=''; if(s.references.length) resourceLinks+=tocLink('References','references',1)+s.references.map((f,i)=>tocLink(f.name,'reference-'+i,2)).join(''); if(s.assets.length) resourceLinks+=tocLink('Assets','assets',1)+s.assets.map((a,i)=>tocLink(a,'asset-'+i,2)).join(''); if(!resourceLinks) resourceLinks='<div class="path">No resources</div>'; toc.innerHTML='<details class="toc-section" open><summary>SKILL.md</summary>'+skillLinks+'</details><details class="toc-section"><summary>Scripts</summary>'+scriptLinks+'</details><details class="toc-section"><summary>Resources</summary>'+resourceLinks+'</details>'; toc.querySelectorAll('.toc-link').forEach(btn=>btn.onclick=()=>scrollToId(btn.dataset.target));}
function renderDetail(){const s=skills.find(x=>x.id===active); if(!s){detail.innerHTML='<div class="empty"><h2>No skills found</h2><p>Add SKILL.md files under a checked skills directory.</p></div>'; toc.innerHTML=''; return} detail.innerHTML='<h2>'+esc(s.name)+(s.is_symlink?symlinkIcon():'')+'</h2><div class="path">'+esc(s.path)+(s.is_symlink?' → '+esc(s.symlink_target):'')+'</div><p>'+esc(s.description)+'</p><section id="skill-md" class="content-section">'+s.body_html+'</section>'+(s.scripts.length?'<h3 id="scripts" class="content-section">Scripts</h3>'+s.scripts.map((f,i)=>fileBox(f,'script-'+i)).join(''):'')+((s.references.length||s.assets.length)?'<h3 id="resources" class="content-section">Resources</h3>'+resources(s):'')+'<div class="meta"><span class="pill">'+esc(s.group)+'</span><span class="pill">'+s.scripts.length+' scripts</span><span class="pill">'+s.references.length+' references</span><span class="pill">'+s.assets.length+' assets</span></div>'; buildToc(s); main.scrollTop=0}
function render(){renderList(); renderDetail()} q.oninput=render; renderAgentFilter(); render();
if (location.protocol === 'http:' || location.protocol === 'https:') {
  const events = new EventSource('/__events');
  events.addEventListener('reload', () => location.reload());
}
</script></body></html>`;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), output: null, includes: [], agents: ['common'], open: true, port: 0, once: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--output' || arg === '-o') args.output = path.resolve(argv[++i]);
    else if (arg === '--include' || arg === '-I') args.includes.push(path.resolve(argv[++i]));
    else if (arg === '--agent' || arg === '-a') args.agents = argv[++i].split(',').map(x => x.trim()).filter(Boolean);
    else if (arg === '--port' || arg === '-p') args.port = Number(argv[++i]);
    else if (arg === '--once') args.once = true;
    else if (arg === '--no-open' || arg === '-n') args.open = false;
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${arg}`); printHelp(); process.exit(2); }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: skill-visualizer [options]\n\nStart a live HTML dashboard for local and global agent skills.\n\nOptions:\n  --root <dir>         Workspace root to scan (default: current directory)\n  -a, --agent <name>   Initially selected agent profile: common, pi, claude, codex, antigravity, copilot, mavis, minimax, hermes\n  -o, --output <file>  Also write the generated HTML file (default: temp directory)\n  -I, --include <dir>  Additional skills directory to scan. Can be repeated\n  -p, --port <port>    Port for the live server (default: random available port)\n  --once               Write one static HTML file and exit\n  -n, --no-open        Do not open the dashboard in a browser\n  -h, --help           Show this help`);
}

function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

function buildSnapshot(args) {
  const selectedAgents = normalizeAgents(args.agents).slice(0, 1);
  if (args.includes.length && !selectedAgents.includes('custom')) selectedAgents.push('custom');
  const sources = [...defaultSources(path.resolve(args.root), ['all']), ...args.includes.map((p, i) => [`Extra ${i + 1}`, p, 'custom'])];
  const skills = sources.flatMap(([group, p, agent]) => discoverIn(p, group, agent));
  const html = buildHtml(skills, sources, selectedAgents);
  return { sources, skills, html };
}

function watchDashboard(args, onChange) {
  let snapshot = buildSnapshot(args);
  const watched = new Map();
  let timer = null;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      snapshot = buildSnapshot(args);
      refreshWatchers();
      onChange(snapshot);
    }, 120);
  };

  const addWatcher = dir => {
    if (!dir || !fs.existsSync(dir)) return;
    let resolved;
    try { resolved = fs.realpathSync(dir); } catch { return; }
    if (watched.has(resolved)) return;
    try {
      const watcher = fs.watch(resolved, { recursive: true }, schedule);
      watched.set(resolved, watcher);
    } catch {
      for (const subdir of walkDirs(resolved)) {
        if (watched.has(subdir)) continue;
        try { watched.set(subdir, fs.watch(subdir, schedule)); } catch {}
      }
    }
  };

  const refreshWatchers = () => {
    for (const [, sourcePath] of snapshot.sources) addWatcher(sourcePath);
    for (const skill of snapshot.skills) {
      addWatcher(skill.path);
      if (skill.is_symlink) addWatcher(skill.symlink_target);
    }
  };

  refreshWatchers();
  return () => snapshot;
}

function writeSnapshot(output, snapshot) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, snapshot.html, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = args.output || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-visualizer-')), 'index.html');
  let current = buildSnapshot(args);
  writeSnapshot(output, current);

  if (args.once) {
    console.log(`Wrote ${current.skills.length} skills to ${output}`);
    if (args.open) openUrl(`file://${path.resolve(output)}`);
    return;
  }

  const clients = new Set();
  const server = http.createServer((req, res) => {
    if (req.url === '/__events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(current.html);
  });

  watchDashboard(args, snapshot => {
    current = snapshot;
    writeSnapshot(output, current);
    for (const client of clients) client.write('event: reload\ndata: changed\n\n');
    console.log(`Reloaded ${current.skills.length} skills after file change`);
  });

  server.listen(args.port, '127.0.0.1', () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Serving ${current.skills.length} skills at ${url}`);
    console.log(`Snapshot: ${output}`);
    console.log('Watching skill directories for changes. Press Ctrl+C to stop.');
    if (args.open) openUrl(url);
  });
}

main();
