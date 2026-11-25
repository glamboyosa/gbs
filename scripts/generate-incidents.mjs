import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { incidentSequence } from '../src/data/incidents-sequence.ts'

// New vector drawings only. The user's shared Excalidraw snapshot is not changed or rehosted.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ink = '#21312d', muted = '#5c6b66', green = '#188568', orange = '#d97732', paper = '#ffffff'
const scene = []
let offset = [0, 0], count = 0, svg = []
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function element(type, x, y, width, height, options = {}) {
  const n = ++count
  const e = { id: `incident-${n}`, type, x: x + offset[0], y: y + offset[1], width, height,
    angle: 0, strokeColor: options.stroke ?? ink, backgroundColor: options.fill ?? 'transparent',
    fillStyle: 'solid', strokeWidth: options.strokeWidth ?? 2, strokeStyle: 'solid', roughness: 1,
    opacity: 100, groupIds: [], frameId: null, roundness: null, seed: n * 131,
    version: 1, versionNonce: n * 137, isDeleted: false, boundElements: null,
    updated: 1795608000000, link: null, locked: false, ...options }
  scene.push(e)
  return e
}
function begin(width, height, title, description, xy) {
  offset = xy
  svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escape(title)}</title><desc id="desc">${escape(description)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="${ink}"/></marker></defs><rect width="100%" height="100%" fill="${paper}"/>`]
}
function rect(x, y, w, h, fill = paper, stroke = ink) {
  svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`)
  element('rectangle', x, y, w, h, { fill, stroke })
}
function circle(x, y, r, fill = paper, stroke = ink) {
  svg.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`)
  element('ellipse', x-r, y-r, r*2, r*2, { fill, stroke })
}
function text(x, y, value, size = 20, color = ink) {
  const lines = String(value).split('\n')
  svg.push(`<text x="${x}" y="${y + size}" fill="${color}" font-size="${size}" font-family="ui-sans-serif,system-ui,sans-serif">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? size * 1.3 : 0}">${escape(line)}</tspan>`).join('')}</text>`)
  element('text', x, y, Math.max(...lines.map(l => l.length)) * size * .58, lines.length * size * 1.3,
    { stroke: color, fontSize: size, fontFamily: 5, text: String(value), originalText: String(value), textAlign: 'left', verticalAlign: 'top', containerId: null, lineHeight: 1.3, autoResize: true })
}
function line(x1, y1, x2, y2, arrow = false, dashed = false, color = ink) {
  svg.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" ${arrow ? 'marker-end="url(#arrow)"' : ''} ${dashed ? 'stroke-dasharray="6 5"' : ''}/>`)
  const x = Math.min(x1, x2), y = Math.min(y1, y2)
  element(arrow ? 'arrow' : 'line', x, y, Math.abs(x2-x1), Math.abs(y2-y1), {
    stroke: color, strokeStyle: dashed ? 'dashed' : 'solid', points: [[x1-x,y1-y],[x2-x,y2-y]],
    startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: arrow ? 'arrow' : null, elbowed: false })
}
function save(relative) {
  const dest = path.join(root, relative)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, svg.join('\n') + '\n</svg>\n')
}
function map(x, y, w, h, selected = false) {
  rect(x,y,w,h,'#f3f7f3','#a7b6ae')
  line(x+20,y+h-30,x+w*.45,y+30,false,false,'#cad7cc')
  line(x+w*.45,y+30,x+w-20,y+h*.6,false,false,'#cad7cc')
  for (const [dx,dy] of [[.25,.3],[.48,.44],[.64,.64],[.77,.27],[.22,.76]]) circle(x+w*dx,y+h*dy,7,orange,orange)
  if (selected) {
    rect(x+w*.16,y+h*.21,w*.56,h*.55,'transparent',green)
    for (const [dx,dy] of [[.25,.3],[.48,.44],[.64,.64]]) circle(x+w*dx,y+h*dy,12,'transparent',green)
  }
}
const titles = ['Separate alerts, no shared record','Select the evidence','Describe a suspected incident','Save evidence with the record','Reopen the same context','Take the record into follow-up']
for (let i=0;i<6;i++) {
  begin(640,460,titles[i], 'Illustrative storyboard, not a screenshot or real community report.', [(i%3)*700,Math.floor(i/3)*540])
  rect(8,8,624,444,paper,'#cad2ce')
  text(32,27,`${String(i+1).padStart(2,'0')} / INCIDENTS`,14,green)
  text(32,61,titles[i],23)
  if(i===0){
    map(190,122,395,230)
    circle(88,183,27); line(88,210,88,290);line(88,235,145,230);line(88,290,62,328);line(88,290,114,328)
    text(40,373,'Which alerts belong together?',23)
  } else if(i===1){
    map(45,116,550,229,true)
    rect(45,367,180,45,'#e8f5ee',green);text(61,376,'3 selected',19,green)
    rect(335,367,260,45,green,green);text(355,376,'Create incident',20,paper)
  } else if(i===2){
    map(38,122,235,270,true);rect(293,122,306,270,'#f8faf8','#a7b6ae')
    text(310,138,'Suspected clearing',21);text(310,181,'Type: Deforestation',16)
    text(310,218,'Description + impact',16);line(311,253,578,253,false,false,'#a7b6ae')
    text(310,269,'Evidence stays attached',16,muted)
    rect(310,326,270,43,green,green);text(328,335,'Save incident',19,paper)
  } else if(i===3){
    rect(40,130,170,75,'#eff6f2',green);text(57,151,'Member check',18)
    rect(285,125,305,100,'#f8faf8');text(305,141,'Warehouse read',20);text(305,174,'source table + source id',16,muted)
    line(210,170,283,170,true)
    rect(155,283,435,100,'#e8f5ee',green);text(175,297,'One configuration transaction',20,green)
    text(175,335,'collection + incident + snapshots',17)
    line(435,225,435,280,true)
    text(42,400,'No change to the original source rows',16,muted)
  } else if(i===4){
    rect(36,118,565,43,'#f7f9f7','#a7b6ae');text(48,128,'.../alerts/view?incidentId=...',17)
    map(36,184,325,219,true);rect(380,184,221,219,'#f8faf8','#a7b6ae')
    text(395,200,'Saved incident',20);text(395,245,'Notes + evidence',16);text(395,282,'Fits map bounds',16,green)
    text(395,329,'Normal access\nchecks still apply',15,muted)
  } else {
    rect(43,123,245,246,'#f8faf8','#a7b6ae');text(61,142,'Incident record',23)
    text(61,190,'Name / description\nCreator / timestamps\nSource table / id\nSaved evidence',17)
    rect(377,139,207,82,'#e8f5ee',green);text(396,152,'CSV',28,green);text(396,188,'Metadata + rows',15)
    rect(377,275,207,82,'#e8f5ee',green);text(396,286,'GeoJSON',25,green);text(396,324,'One feature / entry',15)
    line(288,198,375,181,true);line(288,285,375,315,true)
    text(45,400,'Follow up without rebuilding the selection',18)
  }
  save(`public/images/storyboards/incidents/1-${i+1}.svg`)
}

begin(980,620,'Incident reporting architecture','Map selection reaches the API; warehouse rows are copied into configuration records. Configuration writes are transactional; warehouse reads are separate.',[1850,1300])
text(30,22,'Incident reporting: the records behind the map',26)
rect(35,98,400,112,'#eff6f2',green);text(55,113,'Vue / Nuxt + Mapbox GL',23);text(55,153,'Selection, sidebar, route, highlights',18,muted)
rect(545,98,400,112,'#f7f9f7');text(565,114,'Nuxt incidents API',23);text(565,153,'Member guard + session attribution',18,muted)
line(435,153,543,153,true);text(450,120,'HTTP',14)
rect(35,293,400,126,'#fff6ec',orange);text(55,311,'Warehouse database',23);text(55,352,'Read original source table / id\nAlert + field-observation data',18,muted)
rect(545,293,400,126,'#eff6f2',green);text(565,311,'Configuration database',23);text(565,352,'Collection + incident + entry snapshots\nOne transaction for these writes',17,muted)
line(650,212,650,291,true);line(585,234,260,291,true);text(300,245,'source lookup',15)
rect(35,493,910,92,'#f7f9f7','#a7b6ae');text(57,510,'Reopen with incidentId → restore map context',22);text(57,547,'CSV and GeoJSON are generated from the loaded saved payload in the browser.',18,muted)
line(750,420,750,490,true)
save('public/images/diagrams/incidents-architecture.svg')

begin(1440,1660,'Incident creation and reopening sequence','A monitor selects map evidence, the API validates access, saves source snapshots in a configuration transaction, and later restores an authorised link and client exports.',[300,1300])
text(35,20,'Incidents: create, reopen and export',29)
text(35,65,'Source-backed flow · configuration writes are atomic; warehouse reads are separate',18,muted)
const xs = [110,365,665,980,1295]
const actors = ['Community\nmonitor','Alerts dashboard','Nuxt incidents\nAPI','Warehouse DB','Configuration\nDB']
for(let i=0;i<5;i++){
  rect(xs[i]-105,115,210,66,i===4?'#e8f5ee':'#f7f9f7',i===4?green:ink)
  text(xs[i]-91,127,actors[i],17)
  line(xs[i],182,xs[i],1595,false,true,'#bcc8c1')
}
const wrap = (str, max) => {
  const words = str.split(' '), lines=[];let row=''
  for(const word of words){if(row && (row+' '+word).length>max){lines.push(row);row=word}else row+=(row?' ':'')+word}
  if(row)lines.push(row)
  return lines.join('\n')
}
let y=232
function message(from,to,label,dashed=false){
  const a=xs[from],b=xs[to]
  if(a===b){line(a,y,a+115,y);line(a+115,y,a+115,y+12);line(a+115,y+12,a,y+12,true);text(a+8,y-35,wrap(label,25),13)}
  else {line(a,y,b,y,true,dashed);text(Math.min(a,b)+12,y-36,wrap(label,Math.max(25,Math.floor(Math.abs(b-a)/7.3))),13)}
  y+=54
}
message(0,1,'Select sources and describe incident')
message(1,2,'POST /api/incidents: entries + parent table')
message(2,2,'Member / session / required name')
message(2,4,'BEGIN configuration transaction')
message(2,4,'Insert collection + incident metadata')
message(2,3,'For each entry: read source table / id')
message(3,2,'Source data, or no row',true)
message(2,4,'Insert evidence entry + source_data snapshot')
message(2,4,'COMMIT; rollback writes if a step fails')
message(2,1,'Created incident id',true)
message(1,2,'GET list with parent_alerts_table')
message(2,4,'Filter incident list by current view')
message(2,1,'Saved list; clear selection only after success',true)
y+=12
rect(30,y-17,1380,35,'#e8f5ee',green);text(45,y-12,'Reopen / share / export — normal access checks still apply',15,green);y+=62
message(0,1,'Open incidentId link')
message(1,2,'GET /api/incidents/:id')
message(2,4,'Read collection, incident and saved entries')
message(4,2,'Details + saved source snapshots',true)
message(2,1,'Incident details + entries',true)
message(1,1,'Set route; highlight; fit map bounds')
message(1,0,'Same record and evidence in view',true)
message(0,1,'Download metadata / features')
message(1,0,'CSV / GeoJSON from loaded payload',true)
text(35,1598,'No incident-export API call is required. A shared URL is not a public access grant.',17,muted)
save('public/images/diagrams/incidents-sequence.svg')

fs.mkdirSync(path.join(root,'public/diagrams'),{recursive:true})
fs.writeFileSync(path.join(root,'public/diagrams/incidents-sequence.mmd'),incidentSequence)
fs.writeFileSync(path.join(root,'public/diagrams/incidents.excalidraw'),JSON.stringify({type:'excalidraw',version:2,source:'https://www.glamboyosa.xyz/incidents',elements:scene,appState:{viewBackgroundColor:'#ffffff',gridSize:null},files:{}},null,2)+'\n')
console.log(`Generated six storyboard frames, architecture, sequence, Mermaid and ${scene.length} editable Excalidraw elements.`)
