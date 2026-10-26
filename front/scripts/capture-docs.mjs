import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'

// Use an installed Playwright module, or point to an existing installation.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'
const docs = fileURLToPath(new URL('../../docs/', import.meta.url))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' })
const page = await context.newPage()
const errors = []
const captures = []
page.on('pageerror', error => errors.push(error.message))
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const reference = new Date(`${day}T12:00:00Z`)
const dateAt = offset => { const date = new Date(reference); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10).split('-').reverse().join('/') }
const funds = ['Aurora', 'Horizonte', 'Vale', 'Vértice', 'Ponte', 'Raiz', 'Crescer', 'Norte']
const companies = ['Distribuidora Alfa', 'Indústria Horizonte', 'Comercial do Vale', 'Serviços Aurora', 'Mercantil Ponte', 'Atacado Norte']
const offsets = [-15, -2, 0, 3, 7, 15, 30, 45, 60, 90, 120]
const reasons = ['SITUACAO_CADASTRAL_SACADO', 'CONCENTRACAO_MAXIMA_SACADO', 'VALOR_MINIMO', 'TIPO_RECEBIVEL', 'PRAZO_MAXIMO', 'CNPJ_SACADO_VALIDO', 'NAO_VENCIDA', 'CONCENTRACAO_MAXIMA_CEDENTE', 'PRAZO_MINIMO']
const rows = Array.from({ length: 120 }, (_, index) => {
  const value = (100000 + (index * 31731 % 800000)) / 100
  return { index, value, approved: index % 5 !== 0, fund: funds[index % funds.length], due: dateAt(offsets[index % offsets.length]) }
})
const csv = ['NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO', ...rows.map(row => {
  const i = row.index
  return [`Fundo ${row.fund}`, String(i % 8 + 1).padStart(14, '0'), companies[i % 6], String(i % 6 + 101).padStart(14, '0'), companies[(i * 3 + Math.floor(i / 6)) % 6], String((i * 3 + Math.floor(i / 6)) % 6 + 201).padStart(14, '0'), `NF-${String(i + 1).padStart(5, '0')}`, 'Duplicata', row.value.toFixed(2).replace('.', ','), row.due, dateAt(-30)].join(';')
})].join('\n')
const apiRows = rows.map(row => ({ linha: row.index + 2, id: `NF-${String(row.index + 1).padStart(5, '0')}`, status: row.approved ? 'APROVADO' : 'BARRADO', barrado_por: row.approved ? [] : [reasons[Math.floor(row.index / 5) % reasons.length], reasons[(Math.floor(row.index / 5) + 2) % reasons.length]], precificacao: row.approved && row.index % 7 !== 0 ? { valor_nominal: row.value, valor_desconto: Math.round(row.value * .02 * 100) / 100, valor_liquido: Math.round((row.value - Math.round(row.value * .02 * 100) / 100) * 100) / 100, prazo_dias: 30 } : undefined }))
let apiBase = ''
await page.route('**/recebiveis/upload', route => { apiBase = route.request().url().replace(/\/recebiveis\/upload$/, ''); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiRows) }) })
const rulesConfiguration = JSON.parse(await readFile(new URL('../../back/data/validadores_antecipe.json', import.meta.url), 'utf8'))
await page.route('**/validadores', route => route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rulesConfiguration) }) : route.abort('blockedbyclient'))
await mkdir(docs, { recursive: true })
async function capture(file, description) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(180)
  const viewport = page.viewportSize()
  await page.screenshot({ path: path.join(docs, file) })
  captures.push({ file, description, ...viewport })
}
async function desktop() { await page.setViewportSize({ width: 1440, height: 900 }) }
async function mobile() { await page.setViewportSize({ width: 390, height: 844 }) }
async function panel(index) {
  await page.locator('.dashboard-panel-navigation button').nth(index).click()
  await page.waitForFunction(index => document.querySelector('.dashboard-stage')?.dataset.panelIndex === String(index), index)
}
try {
  await page.goto(baseUrl)
  await page.locator('.landing-intro').waitFor()
  await capture('pagina-inicial.png', 'Abertura da aplicação; capa estática por movimento reduzido')
  await page.locator('#equipe').scrollIntoViewIfNeeded()
  await capture('equipe-desktop.png', 'Equipe responsável e links verificados do GitHub no desktop')
  await mobile();await page.locator('#equipe').scrollIntoViewIfNeeded()
  await capture('equipe-mobile.png', 'Equipe e repositório na página inicial do celular')
  await desktop()
  await page.locator('#analise').scrollIntoViewIfNeeded()
  await capture('topbar-rolagem.png', 'Cabeçalho da página inicial após rolagem e área de upload')
  await page.getByRole('button', { name: 'Configurar regras', exact: true }).click()
  const rulesDialog = page.getByRole('dialog', { name: 'Regras da operação' })
  await rulesDialog.locator('.operation-fields').waitFor()
  await capture('regras-operacao-desktop.png', 'Modal de regras: elegibilidade agrupada por assunto')
  await rulesDialog.getByRole('switch', { name: 'Ativar Valor mínimo da nota', exact: true }).locator('xpath=ancestor::article').getByRole('button', { name: /Ajustar/ }).click()
  await rulesDialog.getByRole('spinbutton', { name: 'Valor mínimo (R$)', exact: true }).scrollIntoViewIfNeeded()
  await capture('regras-parametros-desktop.png', 'Ajuste de parâmetros de uma regra, com ações fixas')
  await rulesDialog.getByRole('tab', { name: /Precificação/ }).click()
  await capture('regras-precificacao-desktop.png', 'Precificação com exemplo ilustrativo, sem salvar alterações')
  await mobile()
  await rulesDialog.getByRole('tab', { name: /Elegibilidade/ }).click()
  await rulesDialog.locator('.operation-body').evaluate(el => { el.scrollTop = 0 })
  await capture('regras-operacao-mobile.png', 'Modal de regras no celular, com abas e ações visíveis')
  await page.keyboard.press('Escape')
  await desktop()
  await mobile();await page.evaluate(() => scrollTo(0, 0))
  await capture('pagina-inicial-mobile.png', 'Página inicial no celular')
  await desktop()
  await page.locator('input[type=file]').setInputFiles({ name: 'demonstracao-documentacao.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('heading', { name: 'Notas processadas' }).waitFor()
  await page.locator('.table-wrap').evaluate(el => { el.scrollTop = 0 })
  await page.mouse.move(1400, 850)
  await capture('pagina-notas.png', 'Notas no desktop, filtros recolhidos')
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await capture('notas-filtros-desktop.png', 'Filtros expandidos da listagem')
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await mobile();await page.evaluate(() => scrollTo(0, 0))
  await capture('notas-mobile.png', 'Notas e barra flutuante inferior no celular')
  await desktop();await page.evaluate(() => scrollTo(0, 0))
  await page.getByRole('button', { name: /Não aprovadas/ }).click()
  await page.getByRole('button', { name: /Ver motivos/ }).first().click()
  await capture('notas-nao-aprovadas-desktop.png', 'Explicação dos motivos de uma nota não aprovada')
  await mobile()
  await capture('notas-nao-aprovadas-mobile.png', 'Detalhes de não aprovação no celular')
  await page.keyboard.press('Escape')
  await desktop()
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
  const names = ['dashboard-paineis-pizzas.png', 'dashboard-paineis-colunas.png', 'dashboard-financeiro.png', 'dashboard-vencimentos.png', 'dashboard-concentracao.png', 'dashboard-impacto-motivos.png', 'dashboard-antecipacao.png']
  for (let i = 0; i < names.length; i++) {
    await panel(i)
    const title = await page.locator('.dashboard-panel.is-active h3').first().textContent()
    await page.mouse.move(1400, 850)
    await capture(names[i], title)
  }
  await panel(0)
  await page.getByRole('button', { name: /^Filtrar por fundo:/ }).click()
  await page.getByRole('dialog', { name: 'Selecionar fundo' }).waitFor()
  await capture('filtro-fundo-desktop.png', 'Modal de seleção de fundo com busca no desktop')
  await mobile()
  await capture('filtro-fundo-mobile.png', 'Modal de fundos com lista interna no celular')
  await page.keyboard.press('Escape')
  await panel(0);await page.locator('.dashboard-stage').blur()
  await capture('dashboard-paineis-mobile.png', 'Visão geral com navegação dos sete painéis no celular')
  await panel(6)
  await capture('dashboard-antecipacao-mobile.png', 'Simulação de antecipação no celular')
  await desktop()
  await page.getByRole('button', { name: 'Nova análise', exact: true }).click()
  await page.evaluate(apiBase => localStorage.setItem(`antecipe:analysis-times:v1:${apiBase}`, JSON.stringify([{ rows: 120, ms: 5000, at: Date.now() }])), apiBase)
  await page.reload()
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', '*')
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
    request.resume()
    request.on('end', () => setTimeout(() => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(apiRows)) }, 3000))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await page.unroute('**/recebiveis/upload')
    await page.route('**/recebiveis/upload', route => route.continue({ url: `http://127.0.0.1:${server.address().port}/recebiveis/upload` }))
    await page.locator('input[type=file]').setInputFiles({ name: 'demonstracao-documentacao.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByRole('heading', { name: 'Analisando as notas fiscais' }).waitFor()
    await page.getByText(/Tempo restante estimado da análise:/).waitFor()
    await capture('processamento-estimativa.png', 'Faixa de tempo de processamento; histórico e atraso controlados para demonstração')
    await page.getByRole('heading', { name: 'Notas processadas' }).waitFor()
  } finally { server.closeAllConnections(); server.close() }
  assert.deepEqual(errors, [])
  await writeFile(path.join(docs, 'capturas-interface.json'), JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl, source: 'Dados sintéticos e resposta controlada no navegador; não são resultados de uma carteira real nem validação de regras do backend', referenceDate: day, notes: rows.length, funds: funds.length, approved: rows.filter(row => row.approved).length, rejected: rows.filter(row => !row.approved).length, reducedMotion: true, captures, pageErrors: errors }, null, 2) + '\n')
  console.log(JSON.stringify({ captured: captures.length, notes: rows.length, errors }))
} finally { await browser.close() }
