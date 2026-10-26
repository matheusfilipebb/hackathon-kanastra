import test from 'node:test'
import assert from 'node:assert/strict'
import { financialSummary, maturitySummary, dateDay, todayInSaoPaulo } from '../src/dashboardMetrics.ts'

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
