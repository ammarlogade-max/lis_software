// Safe client-side arithmetic evaluator used for report formulas.
// Used for instant visual feedback while a technician types raw values.
// The authoritative calculation is performed by the save_order_results
// Supabase function before values are persisted.

function evalArithmetic(expr: string): number {
  let i = 0;
  const s = expr.replace(/\s+/g, '');

  function peek() {
    return s[i];
  }
  function parseNumber(): number {
    const start = i;
    if (s[i] === '+' || s[i] === '-') i++;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    const num = parseFloat(s.slice(start, i));
    if (Number.isNaN(num)) throw new Error('Invalid number in formula');
    return num;
  }
  function parseFactor(): number {
    if (peek() === '(') {
      i++;
      const val = parseExpr();
      if (peek() !== ')') throw new Error('Unbalanced parentheses in formula');
      i++;
      return val;
    }
    if (peek() === '-' || peek() === '+') {
      const sign = peek() === '-' ? -1 : 1;
      i++;
      return sign * parseFactor();
    }
    return parseNumber();
  }
  function parseTerm(): number {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = peek();
      i++;
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : val / rhs;
    }
    return val;
  }
  function parseExpr(): number {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek();
      i++;
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  const result = parseExpr();
  if (i !== s.length) throw new Error('Unexpected trailing characters in formula');
  return result;
}

function roundToFormat(value: number, decimalFormat?: string | null): string {
  const decimals = decimalFormat ? (decimalFormat.split('.')[1] || '').length : 2;
  return value.toFixed(Math.min(Math.max(decimals, 0), 6));
}

export interface FormulaParam {
  id: string;
  formula?: string | null;
  decimal_format?: string | null;
}

/**
 * Given the ordered parameter list for a test group and a map of
 * parameter id -> currently entered/displayed value, returns a NEW map
 * with every formula-driven parameter recalculated from the others
 * (ID1 = 1st parameter's value, ID2 = 2nd, ...). Parameters whose formula
 * can't yet be evaluated (an input is still blank) are left untouched.
 */
export function computeFormulas(params: FormulaParam[], values: Record<string, string>): Record<string, string> {
  const next = { ...values };
  for (const param of params) {
    if (!param.formula || !param.formula.trim()) continue;
    let expr = param.formula;
    let hasAllInputs = true;
    expr = expr.replace(/ID(\d+)/g, (_match, posStr) => {
      const pos = parseInt(posStr, 10) - 1;
      const refParam = params[pos];
      const raw = refParam ? next[refParam.id] : undefined;
      const num = raw !== undefined && raw !== '' ? parseFloat(String(raw).replace(/,/g, '')) : NaN;
      if (Number.isNaN(num)) hasAllInputs = false;
      return String(Number.isNaN(num) ? 0 : num);
    });
    if (!hasAllInputs) continue;
    try {
      next[param.id] = roundToFormat(evalArithmetic(expr), param.decimal_format);
    } catch {
      // Malformed formula — leave whatever value was there.
    }
  }
  return next;
}
