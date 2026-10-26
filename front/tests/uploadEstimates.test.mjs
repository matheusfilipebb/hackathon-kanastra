import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanHistory, estimateAnalysis, readAnalysisHistory, saveAnalysisHistory, transferBytesPerSecond } from '../src/uploadEstimates.ts'
const now=Date.now()
const sample=(rows,ms,at=now)=>({rows,ms,at})
test('sem histórico ou com tamanho incomparável não inventa estimativa',()=>{
  assert.equal(estimateAnalysis(100,[],now),null)
  assert.equal(estimateAnalysis(100000,[sample(10,500)],now),null)
  assert.equal(estimateAnalysis(0,[sample(100,500)],now),null)
})
test('faixa por quantidade de notas cobre a mediana e rejeita uma duração extrema',()=>{
  const result=estimateAnalysis(200,[sample(100,1000),sample(100,1100),sample(100,900),sample(100,100000)],now)
  assert.ok(result.lowerMs<2000 && result.upperMs>2000 && result.upperMs<5000)
  assert.equal(result.samples,3)
})
test('histórico limitado, recente e válido; armazenamento indisponível ou corrompido é tolerado',()=>{
  const data=[...Array.from({length:15},(_,i)=>sample(100,1000,now-i)),sample(0,1000),sample(100,NaN),sample(100,1000,now-8*86400000)]
  assert.equal(cleanHistory(data,now).length,10)
  const failing={getItem(){throw new Error('blocked')},setItem(){throw new Error('quota')}}
  assert.deepEqual(readAnalysisHistory('api',failing),[])
  assert.doesNotThrow(()=>saveAnalysisHistory('api',[],failing))
  const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
  saveAnalysisHistory('api-a',[sample(100,1000)],storage)
  assert.equal(readAnalysisHistory('api-a',storage).length,1)
  assert.equal(readAnalysisHistory('api-b',storage).length,0)
})
test('transferência considera velocidade recente e ignora amostras sem duração ou progresso',()=>{
  assert.equal(transferBytesPerSecond([{loaded:0,at:0},{loaded:1000,at:1000}]),1000)
  assert.equal(transferBytesPerSecond([{loaded:0,at:0},{loaded:1000,at:1000},{loaded:2000,at:6000},{loaded:4000,at:7000}]),2000)
  assert.equal(transferBytesPerSecond([{loaded:1000,at:1000},{loaded:1000,at:2000}]),undefined)
  assert.equal(transferBytesPerSecond([{loaded:0,at:0},{loaded:1000,at:1}]),undefined)
})
