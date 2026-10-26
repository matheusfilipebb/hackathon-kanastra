import test from 'node:test'
import assert from 'node:assert/strict'
import { financialSummary, pricingSummary, reasonImpactSummary, concentrationSummary, maturitySummary, dateDay, todayInSaoPaulo } from '../src/dashboardMetrics.ts'

test('totais financeiros em centavos, incluindo zeros e ignorando valores inválidos', () => {
  assert.deepEqual(financialSummary([{valor:.1, aprovado:true},{valor:.2, aprovado:true},{valor:9.99, aprovado:false},{valor:NaN, aprovado:false},{valor:-10, aprovado:false}]), {approved:30,rejected:999,total:1029,invalid:2})
  assert.deepEqual(financialSummary([]), {approved:0,rejected:0,total:0,invalid:0})
})

test('vencimentos sem sobreposição, datas impossíveis e referência no fuso de São Paulo', () => {
  const days=['2026-10-25','2026-10-26','2026-11-02','2026-11-25','2026-12-25','2027-01-24','2027-01-25','2026-02-30','']
  const result=maturitySummary(days.map(vencimento=>({vencimento,valor:10})), '2026-10-26')
  assert.deepEqual(result.map(x=>x.count),[1,1,1,1,1,1,1,2])
  assert.equal(result.reduce((sum,x)=>sum+x.value,0),9000)
  assert.equal(dateDay('2026-02-29'),null)
  assert.notEqual(dateDay('2024-02-29'),null)
  assert.equal(todayInSaoPaulo(new Date('2026-10-26T01:00:00Z')),'2026-10-25')
})

test('concentração agrupa documentos formatados, separa homônimos e conserva o valor total', () => {
  const rows=[{sacado:'Alfa',cnpj:'12.345',cedente:'Loja',valor:10},{sacado:'Alfa',cnpj:'12345',cedente:'loja',valor:20},{sacado:'Alfa',cnpj:'999',cedente:'Outra',valor:5}]
  const result=concentrationSummary(rows,'sacado')
  assert.deepEqual(result.map(x=>[x.document,x.value,x.count]),[['12345',3000,2],['999',500,1]])
  assert.equal(concentrationSummary(rows,'cedente').length,2)
  assert.equal(result.reduce((sum,x)=>sum+x.value,0),3500)
})

test('impacto por motivo elimina duplicatas por nota e explicita motivos sobrepostos', () => {
  const rows=[{valor:100,aprovado:false,motivos:['VALOR_MINIMO','VALOR_MINIMO','PRAZO_MAXIMO']},{valor:50,aprovado:false,motivos:['VALOR_MINIMO']},{valor:999,aprovado:true,motivos:['VALOR_MINIMO']},{valor:10,aprovado:false,motivos:[]}]
  const result=reasonImpactSummary(rows)
  assert.deepEqual(result.map(x=>[x.value,x.count]),[[15000,2],[10000,1],[1000,1]])
  assert.equal(financialSummary(rows).rejected,16000)
  assert.equal(result.reduce((sum,x)=>sum+x.value,0),26000)
})

test('simulação usa apenas preços válidos de aprovadas, conserva totais e pondera o prazo', () => {
  const price=(nominal,desconto,liquido,dias)=>({valor_nominal:nominal,valor_desconto:desconto,valor_liquido:liquido,prazo_dias:dias})
  const rows=[{aprovado:true,fundo:'A',precificacao:price(100,10,90,10)},{aprovado:true,fundo:'B',precificacao:price(300,30,270,30)},{aprovado:true},{aprovado:true,precificacao:price(100,200,90,10)},{aprovado:false,precificacao:price(1000,0,1000,30)}]
  const result=pricingSummary(rows)
  assert.deepEqual([result.approved,result.count,result.missing,result.nominal,result.discount,result.liquid,result.averageDays],[4,2,2,40000,4000,36000,25])
  assert.equal(result.funds[0].name,'B')
  assert.equal(pricingSummary([]).count,0)
})
