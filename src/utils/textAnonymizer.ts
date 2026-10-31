export type TokenType = 'currency' | 'date' | 'email' | 'digits' | 'word';

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnonymizedWord extends OcrWord {
  originalText: string;
  replacementText: string;
  tokenType: TokenType;
}

export interface AnonymizedLine extends OcrLine {
  words: AnonymizedWord[];
  replacementText: string;
}

// Dicionário de termos variados por faixa de comprimento para manter a estética de layout
const LEXICON_BY_LENGTH: Record<number, string[]> = {
  2: ['de', 'em', 'se', 'ou', 'do', 'da', 'na', 'no', 'as', 'os', 'um'],
  3: ['com', 'por', 'que', 'dos', 'das', 'ano', 'mes', 'dia', 'uso', 'via', 'ato', 'web'],
  4: ['item', 'taxa', 'pago', 'data', 'lote', 'meta', 'fase', 'nome', 'base', 'tipo', 'hora', 'modo'],
  5: ['valor', 'saldo', 'total', 'grupo', 'prazo', 'plano', 'termo', 'marca', 'ordem', 'setor', 'custo'],
  6: ['codigo', 'numero', 'origem', 'recibo', 'modulo', 'status', 'period', 'limite', 'acordo', 'parcel'],
  7: ['cliente', 'empresa', 'projeto', 'produto', 'servico', 'arquivo', 'usuario', 'process', 'sistema'],
  8: ['cadastro', 'registro', 'controle', 'relacao', 'contrato', 'comercio', 'reunioes', 'pesquisa'],
  9: ['documento', 'pagamento', 'descricao', 'operacoes', 'seguranca', 'resultado', 'protocolo'],
  10: ['faturamento', 'transacoes', 'vencimento', 'patrimonio', 'fornecedor', 'integracao'],
  11: ['autorizacao', 'comprovante', 'declaracoes', 'atualizacao', 'planejamento'],
  12: ['departamento', 'transferencia', 'demonstrativo', 'administracao'],
};

const DEFAULT_WORDS = [
  'relatorio', 'analise', 'registro', 'operacao', 'protocolo', 'documento',
  'sistema', 'recurso', 'consulta', 'atividade', 'auditoria', 'execucao'
];

/**
 * Classifica a natureza semântica de uma palavra ou token textual.
 */
export function classifyTokenType(text: string): TokenType {
  const trimmed = text.trim();

  // 1. Moedas / Valores monetários (R$, $, €, £)
  if (/^(R\$|\$|€|£)\s?[0-9.,]+$/i.test(trimmed) || /^[0-9.,]+\s?(R\$|\$|€|£)$/i.test(trimmed)) {
    return 'currency';
  }

  // 2. Datas (DD/MM/AAAA, AAAA-MM-DD, DD.MM.AAAA)
  if (/^[0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4}$/.test(trimmed)) {
    return 'date';
  }

  // 3. E-mails
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'email';
  }

  // 4. Dígitos, documentos (CPF, RG, CNPJ) e telefones
  const digitCount = (trimmed.match(/[0-9]/g) || []).length;
  if (digitCount >= 3 && /^[0-9\(\)\-\.\s\/\:\+]+$/.test(trimmed)) {
    return 'digits';
  }

  // 5. Palavras padrão
  return 'word';
}

/**
 * Aplica a mesma capitalização da palavra original sobre a palavra gerada.
 */
function applyCasing(original: string, replacement: string): string {
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  const isTitle = original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase();
  if (isTitle) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement.toLowerCase();
}

/**
 * Substitui sequências numéricas preservando pontuação e máscaras (ex: CPF, telefone, CEP).
 */
function anonymizeDigits(text: string): string {
  return text.replace(/[0-9]/g, () => Math.floor(Math.random() * 10).toString());
}

/**
 * Gera um valor monetário sintético similar.
 */
function anonymizeCurrency(text: string): string {
  const prefixMatch = text.match(/^(R\$|\$|€|£)\s?/i);
  const prefix = prefixMatch ? prefixMatch[0] : 'R$ ';
  const thousands = Math.floor(Math.random() * 899) + 1;
  const hundreds = (Math.floor(Math.random() * 899) + 100).toString().padStart(3, '0');
  const cents = (Math.floor(Math.random() * 89) + 10).toString().padStart(2, '0');

  if (text.includes('.') && text.includes(',')) {
    return `${prefix}${thousands}.${hundreds},${cents}`;
  }
  if (text.includes(',')) {
    return `${prefix}${thousands},${cents}`;
  }
  if (text.includes('.')) {
    return `${prefix}${thousands}.${cents}`;
  }
  return `${prefix}${thousands}`;
}

/**
 * Gera uma data sintética preservando o delimitador.
 */
function anonymizeDate(text: string): string {
  const delimiter = text.includes('/') ? '/' : text.includes('-') ? '-' : '.';
  const parts = text.split(delimiter);

  const day = (Math.floor(Math.random() * 27) + 1).toString().padStart(2, '0');
  const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
  const year = (Math.floor(Math.random() * 5) + 2021).toString();

  if (parts[0].length === 4) {
    // AAAA-MM-DD
    return `${year}${delimiter}${month}${delimiter}${day}`;
  }
  return `${day}${delimiter}${month}${delimiter}${year}`;
}

/**
 * Gera um e-mail sintético de tamanho proporcional.
 */
function anonymizeEmail(text: string): string {
  const [localPart, domainPart] = text.split('@');
  const domains = ['empresa.com', 'corporativo.net', 'portal.org', 'servicos.io', 'demo.corp'];
  const usernames = ['usuario', 'cliente', 'contato', 'gestor', 'alex.silva', 'mariana', 'suporte'];

  const chosenDomain = domains[Math.floor(Math.random() * domains.length)];
  const chosenUser = usernames[Math.floor(Math.random() * usernames.length)];

  // Preserva se terminava em .br
  const tldBr = domainPart && domainPart.endsWith('.br') ? '.br' : '';
  return `${chosenUser}@${chosenDomain}${tldBr}`;
}

/**
 * Sorteia uma palavra substituta proporcional em comprimento e estilo.
 */
function anonymizeGeneralWord(text: string): string {
  const clean = text.replace(/[^a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '');
  const targetLen = Math.max(2, Math.min(12, clean.length || text.length));

  const pool = LEXICON_BY_LENGTH[targetLen] || DEFAULT_WORDS;
  let candidate = pool[Math.floor(Math.random() * pool.length)];

  // Garante que a palavra candidata não seja idêntica à original
  if (candidate.toLowerCase() === text.toLowerCase() && pool.length > 1) {
    candidate = pool.find((w) => w.toLowerCase() !== text.toLowerCase()) || candidate;
  }

  // Preserva pontuação que estava colada à palavra (ex: vírgula ou ponto final)
  const punctuationMatch = text.match(/([.,;:!?]+)$/);
  const trailingPunctuation = punctuationMatch ? punctuationMatch[1] : '';

  return applyCasing(text, candidate) + trailingPunctuation;
}

/**
 * Anonimiza uma única palavra ou token de forma contextual e esteticamente realista.
 */
export function anonymizeWord(text: string): string {
  const tokenType = classifyTokenType(text);

  switch (tokenType) {
    case 'currency':
      return anonymizeCurrency(text);
    case 'date':
      return anonymizeDate(text);
    case 'email':
      return anonymizeEmail(text);
    case 'digits':
      return anonymizeDigits(text);
    case 'word':
    default:
      return anonymizeGeneralWord(text);
  }
}

/**
 * Converte um conjunto de linhas e caixas retornadas pelo OCR em linhas com texto sintético anonimizado.
 */
export function anonymizeOcrLines(lines: OcrLine[]): AnonymizedLine[] {
  return lines.map((line) => {
    const anonymizedWords: AnonymizedWord[] = line.words.map((word) => ({
      ...word,
      originalText: word.text,
      replacementText: anonymizeWord(word.text),
      tokenType: classifyTokenType(word.text),
    }));

    const replacementText = anonymizedWords.map((w) => w.replacementText).join(' ');

    return {
      ...line,
      words: anonymizedWords,
      replacementText,
    };
  });
}
