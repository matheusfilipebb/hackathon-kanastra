import test from 'node:test'
import assert from 'node:assert/strict'
import { financialSummary } from '../src/dashboardMetrics.ts'

test('totais financeiros em centavos, incluindo zeros e ignorando valores inválidos', () => {
  assert.deepEqual(financialSummary([{valor:.1, aprovado:true},{valor:.2, aprovado:true},{valor:9.99, aprovado:false},{valor:NaN, aprovado:false},{valor:-10, aprovado:false}]), {approved:30,rejected:999,total:1029,invalid:2})
  assert.deepEqual(financialSummary([]), {approved:0,rejected:0,total:0,invalid:0})
})
