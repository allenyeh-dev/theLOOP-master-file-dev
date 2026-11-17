import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

// The SOP / recipe template is one Word table: Field | English | 中文.
// Brand (and department for SOPs) are choice rows pre-filled for the user; every other row holds grey example
// text that the user overwrites. A cell left exactly as the example is treated as empty when uploaded.
// Built and read in the browser (a .docx is a zip of XML), so the template can carry the user's own brand.

// ex = [English lines, 中文 lines]; choice rows have no example.
export const TEMPLATE_ROWS = {
  sop: [
    { field: 'brand', label: ['Brand', '品牌'], choice: true },
    { field: 'department', label: ['Department', '部門'], choice: true },
    { field: 'audience', label: ['Audience (role)', '適用對象（職位）'], ex: [['Bartender, Bar Back'], ['吧檯人員、助手']] },
    { field: 'title', label: ['Title', '標題'], ex: [['Restocking Garnish Station'], ['補充裝飾物工作站']] },
    { field: 'purpose', label: ['Purpose', '目的'], ex: [['To ensure the garnish station never runs short during service.'], ['確保營業期間裝飾物工作站不缺料。']] },
    {
      field: 'standards', label: ['Key standards (one per line)', '關鍵準則（一行一條）'],
      ex: [['• Check garnish levels every hour', '• Restock before dropping below 20%', '• Log restocks in the shift handoff'], ['• 每小時檢查裝飾物存量', '• 低於20%前即補貨', '• 於交班紀錄中記錄補貨情形']],
    },
    {
      field: 'steps', label: ['Steps (one per line, same count in both languages)', '步驟（一行一步，兩種語言步數需一致）'],
      ex: [['1. Check station at the top of each hour', '2. Restock any item below 20%', '3. Note restock in handoff log'], ['1. 每小時整點檢查工作站', '2. 補充低於20%之品項', '3. 於交班紀錄中註記補貨情形']],
    },
    { field: 'notes', label: ['Notes (anything unclear or NEEDS CONFIRMATION)', '備註（不確定或待確認的事）'], ex: [[], []] },
  ],
  recipe: [
    { field: 'brand', label: ['Brand', '品牌'], choice: true },
    { field: 'code', label: ['Recipe number (leave blank if new)', '食譜編號（新增請留空）'], ex: [[], []] },
    { field: 'menu_category', label: ['Menu category', '菜單分類'], ex: [['Signature Cocktails'], ['招牌調酒']] },
    { field: 'audience', label: ['Audience (role)', '適用對象（職位）'], ex: [['Bartender, Bar Back'], ['吧檯人員、助手']] },
    { field: 'name', label: ['Item name', '品項名稱'], ex: [['Smoked Paper Plane'], ['煙燻紙飛機']] },
    {
      field: 'ingredients', label: ['Ingredients (one per line: quantity | unit | name)', '食材（一行一項：數量 | 單位 | 名稱）'],
      ex: [['20 | ml | Bourbon', '20 | ml | Aperol', '20 | ml | Amaro Nonino', '20 | ml | Fresh Lemon Juice'], ['20 | ml | 波本威士忌', '20 | ml | Aperol', '20 | ml | Amaro Nonino', '20 | ml | 新鮮檸檬汁']],
    },
    {
      field: 'steps', label: ['Method (one step per line, same count in both languages)', '做法（一行一步，兩種語言步數需一致）'],
      ex: [['1. Combine all ingredients in shaker with ice', '2. Shake hard for 10 seconds', '3. Double strain into a smoke-filled coupe', '4. Serve immediately'], ['1. 將所有材料與冰塊加入雪克杯', '2. 用力搖盪10秒', '3. 雙重過濾倒入充滿煙燻的雞尾酒杯', '4. 立即出杯']],
    },
    { field: 'garnish', label: ['Garnish', '裝飾'], ex: [['None'], ['無']] },
    { field: 'glassware', label: ['Glassware', '杯具'], ex: [['Coupe glass (smoked)'], ['雞尾酒杯（煙燻）']] },
    { field: 'notes', label: ['Notes / source (optional)', '備註 / 來源（選填）'], ex: [[], []] },
  ],
}

const TITLE = { sop: ['SOP Template', 'SOP 範本'], recipe: ['Recipe Template', '食譜範本'] }
export const CHECK = '☐'
export const CHECKED = '☒'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const run = (text, { bold, grey, size } = {}) =>
  `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft JhengHei"/>${bold ? '<w:b/>' : ''}${grey ? '<w:i/><w:color w:val="7F7F7F"/>' : ''}<w:sz w:val="${size ?? 21}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
const para = (text, opts) => `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${text === '' ? '' : run(text, opts)}</w:p>`

const cell = (lines, width, opts = {}, shade) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}</w:tcPr>${(lines.length ? lines : ['']).map((l) => para(l, opts)).join('')}</w:tc>`

// Options as one line each: "☒ SPC" (default ticked) / "☐ BOH". A single option is written plain.
function choiceLines(options, ticked) {
  if (options.length <= 1) return options
  return options.map((o) => `${o === ticked ? CHECKED : CHECK} ${o}`)
}

const W = [2300, 3669, 3669]

// ctx = { brands: string[], defaultBrand?: string, departments?: string[] } -> Uint8Array (.docx)
export function buildTemplate(kind, ctx) {
  const brands = ctx.brands ?? []
  const departments = ctx.departments ?? []
  const defaultBrand = ctx.defaultBrand && brands.includes(ctx.defaultBrand) ? ctx.defaultBrand : brands[0]
  const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cell(['Field / 欄位'], W[0], { bold: true }, 'D9D9D9')}${cell(['English'], W[1], { bold: true }, 'D9D9D9')}${cell(['中文'], W[2], { bold: true }, 'D9D9D9')}</w:tr>`
  const rows = TEMPLATE_ROWS[kind].map((r) => {
    let en
    let zh
    if (r.choice) {
      const opts = r.field === 'brand' ? brands : departments
      en = zh = choiceLines(opts, r.field === 'brand' ? defaultBrand : null)
    } else {
      ;[en, zh] = r.ex
    }
    const grey = !r.choice
    return `<w:tr>${cell(r.label, W[0], { bold: true })}${cell(en, W[1], { grey })}${cell(zh, W[2], { grey })}</w:tr>`
  })
  const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>`).join('')
  const table = `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b)}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${head}${rows.join('')}</w:tbl>`

  const tips = [
    'Replace the grey example text with your own. Fill in one language or both; the step counts must match when both are filled.',
    '請把灰色範例文字改成你的內容。可只填一種語言，兩種都填時步數需一致。',
    `Brand${kind === 'sop' ? ' / department' : ''}: change ${CHECK} to ${CHECKED} on the one that applies (or delete the others).`,
    `品牌${kind === 'sop' ? '／部門' : ''}：在適用的選項前把 ${CHECK} 改成 ${CHECKED}（或刪掉其他選項）。`,
  ]
  const body = `${para(`${TITLE[kind][0]} · ${TITLE[kind][1]}`, { bold: true, size: 32 })}${tips.map((t) => para(t, { size: 19 })).join('')}${para('')}${table}<w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`

  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(doc),
  })
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function downloadTemplate(kind, ctx) {
  const blob = new Blob([buildTemplate(kind, ctx)], { type: DOCX_MIME })
  const a = document.createElement('a')
  const brand = (ctx.defaultBrand || ctx.brands?.[0] || '').replace(/[^\w㐀-鿿-]+/g, '')
  a.href = URL.createObjectURL(blob)
  a.download = `${kind === 'sop' ? 'SOP' : 'Recipe'}-template${brand ? `-${brand}` : ''}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------- reading ----------
const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&')

// A paragraph's text: <w:t> runs, <w:tab/> and <w:br/> (deleted tracked text is <w:delText>, so it is skipped).
function paragraphText(xml) {
  let out = ''
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/?>|<w:tab\s*\/?>/g)) out += m[1] !== undefined ? decode(m[1]) : m[0].startsWith('<w:br') ? '\n' : '\t'
  return out
}

const linesOf = (cellXml) =>
  [...cellXml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .flatMap((p) => paragraphText(p[1]).split('\n'))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

function documentXml(buf) {
  let files
  try {
    files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'word/document.xml' })
  } catch {
    throw new Error('not-docx')
  }
  if (!files['word/document.xml']) throw new Error('not-docx')
  return strFromU8(files['word/document.xml'])
}

// Every table row of the document as [cell lines, ...]. Nested tables are not supported (the template has none).
export function readDocxRows(buf) {
  const xml = documentXml(buf)
  return [...xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map((tr) =>
    [...tr[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((tc) => linesOf(tc[1]))
  )
}

// All paragraphs as plain text (for handing a non-template Word file to AI).
export function readDocxText(buf) {
  return [...documentXml(buf).matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map((p) => paragraphText(p[1]).trim()).filter(Boolean).join('\n')
}
