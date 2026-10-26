import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizedConfiguration, validateEditor, parameterSummary } from '../src/validatorEditor.ts'
const original={fundo:{nome:'ANTECIPE FIDC',cnpj:'92.234.400/0001-80'},validadores:[
 {codigo:'VALOR_MINIMO',ativo:true,parametros:{valor_minimo:100}},
 {codigo:'CONCENTRACAO_MAXIMA_SACADO',ativo:true,parametros:{percentual_maximo:10,agrupamento:'RAIZ_CNPJ'}},
 {codigo:'PRAZO_MINIMO',ativo:false,parametros:{prazo_minimo_dias:30}},
 {codigo:'PRAZO_MAXIMO',ativo:true,parametros:{prazo_maximo_dias:180}},
 {codigo:'TIPO_RECEBIVEL',ativo:true,parametros:{tipos_aceitos:['Duplicata','Duplicata de Serviço']}}
],precificacao:{metodo:'DESCONTO_SIMPLES',taxa_mensal_percentual:2,base_dias:30}}
const fixture=()=>structuredClone(original)
test('configuração original é válida; normalização preserva parâmetros e remove espaços do fundo',()=>{
  const config=fixture();config.fundo.nome=' Fundo Exemplo '
  const normalized=normalizedConfiguration(config)
  assert.equal(normalized.fundo.nome,'Fundo Exemplo')
  assert.deepEqual(normalized.validadores,original.validadores)
  assert.equal(validateEditor(normalized),null)
})
test('validação encontra erros em abas ou parâmetros recolhidos, incluindo regras inativas',()=>{
  const config=fixture();const rule=config.validadores.find(x=>x.codigo==='PRAZO_MINIMO');rule.parametros.prazo_minimo_dias=NaN
  assert.deepEqual(validateEditor(config).field,'PRAZO_MINIMO-prazo_minimo_dias')
  rule.parametros.prazo_minimo_dias=30
  config.precificacao.base_dias=0
  assert.equal(validateEditor(config).tab,'pricing')
  config.fundo.nome=' '
  assert.equal(validateEditor(config).tab,'fund')
})
test('limites de percentual, prazos conflitantes e listas vazias são explicados antes do envio',()=>{
  const config=fixture();const rule=config.validadores.find(x=>x.codigo==='CONCENTRACAO_MAXIMA_SACADO');rule.parametros.percentual_maximo=101
  assert.equal(validateEditor(config).rule,rule.codigo)
  rule.parametros.percentual_maximo=10
  const min=config.validadores.find(x=>x.codigo==='PRAZO_MINIMO');min.ativo=true;min.parametros.prazo_minimo_dias=181
  assert.match(validateEditor(config).message,/prazo mínimo/)
  min.ativo=false
  config.validadores.find(x=>x.codigo==='TIPO_RECEBIVEL').parametros.tipos_aceitos=[]
  assert.match(validateEditor(config).message,/ao menos uma opção/)
})
test('resumo de regra usa unidades e evita expor códigos internos',()=>{
  assert.match(parameterSummary(original.validadores.find(x=>x.codigo==='VALOR_MINIMO')),/100,00/)
  assert.match(parameterSummary(original.validadores.find(x=>x.codigo==='CONCENTRACAO_MAXIMA_SACADO')),/Raiz do CNPJ/)
  assert.doesNotMatch(parameterSummary(original.validadores.find(x=>x.codigo==='CONCENTRACAO_MAXIMA_SACADO')),/RAIZ_CNPJ/)
})
