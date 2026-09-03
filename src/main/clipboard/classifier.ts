import crypto from 'crypto';
import { ClipboardType } from '../../shared/types';

export interface ClassificationResult {
  type: ClipboardType;
  preview: string;
  language?: string;
  isPotentialPassword?: boolean;
}

export function computeHash(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function classifyText(text: string): ClassificationResult {
  const trimmed = text.trim();
  const preview = trimmed.length > 300 ? trimmed.slice(0, 300) + '…' : trimmed;

  // 1. Check if potential password or secret
  const isPotentialPassword = detectPasswordOrSecret(trimmed);

  // 2. Check if URL
  const urlRegex = /^(https?:\/\/[^\s/$.?#].[^\s]*|ftp:\/\/[^\s/$.?#].[^\s]*)$/i;
  if (urlRegex.test(trimmed)) {
    return {
      type: 'URL',
      preview: trimmed,
      isPotentialPassword: false,
    };
  }

  // 3. Check if Windows or Unix File Path
  const winPathRegex = /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/;
  const unixPathRegex = /^\/(?:[^/\0]+\/)*[^/\0]+$/;
  if ((winPathRegex.test(trimmed) || unixPathRegex.test(trimmed)) && !trimmed.includes('\n')) {
    return {
      type: 'FILE',
      preview: trimmed,
      isPotentialPassword: false,
    };
  }

  // 4. Check if Code Snippet
  const codeDetection = detectCodeLanguage(trimmed);
  if (codeDetection.isCode) {
    return {
      type: 'CODE',
      preview,
      language: codeDetection.language,
      isPotentialPassword,
    };
  }

  // 5. Default to plain text
  return {
    type: 'TEXT',
    preview,
    isPotentialPassword,
  };
}

function detectPasswordOrSecret(str: string): boolean {
  // Secret token patterns (API keys, JWT, SSH keys, private keys)
  if (/^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/.test(str)) return true;
  if (/^sk_[a-zA-Z0-9_-]{20,}/.test(str)) return true;
  if (/^Bearer\s+[a-zA-Z0-9_\-\.]{20,}/i.test(str)) return true;
  if (/^eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/.test(str)) return true;
  if (/-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(str)) return true;

  // Single token password heuristic
  if (str.length >= 8 && str.length <= 64 && !/\s/.test(str)) {
    let categories = 0;
    if (/[a-z]/.test(str)) categories++;
    if (/[A-Z]/.test(str)) categories++;
    if (/[0-9]/.test(str)) categories++;
    if (/[^a-zA-Z0-9]/.test(str)) categories++;

    if (categories >= 3) {
      // Calculate Shannon entropy
      const entropy = calculateEntropy(str);
      // High entropy random string (usually > 3.3 for 12+ chars)
      if (entropy > 3.3 && str.length >= 10) {
        return true;
      }
    }
  }

  return false;
}

function calculateEntropy(str: string): number {
  const map: Record<string, number> = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    map[c] = (map[c] || 0) + 1;
  }
  let entropy = 0;
  for (const c in map) {
    const p = map[c] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function detectCodeLanguage(text: string): { isCode: boolean; language?: string } {
  // Quick check for JSON
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text);
      return { isCode: true, language: 'JSON' };
    } catch {}
  }

  // HTML / XML
  if (/<(!DOCTYPE html|[a-z0-9]+)(\s+[^>]+)?>[\s\S]*<\/[a-z0-9]+>/i.test(text) || /^<[a-z0-9]+(\s+[^>]+)?\/?>/i.test(text)) {
    return { isCode: true, language: 'HTML' };
  }

  // SQL
  if (/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(text)) {
    return { isCode: true, language: 'SQL' };
  }

  // Python
  if (/\b(def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(|import\s+[a-zA-Z_]|from\s+[a-zA-Z_].*import|class\s+[a-zA-Z_].*:|elif\s+.*:|if\s+__name__\s*==\s*['"]__main__['"]:)/.test(text)) {
    return { isCode: true, language: 'Python' };
  }

  // JavaScript / TypeScript
  if (
    /\b(const\s+[a-zA-Z0-9_$]+\s*=|let\s+[a-zA-Z0-9_$]+\s*=|var\s+[a-zA-Z0-9_$]+\s*=|function\s+[a-zA-Z0-9_$]*\s*\(|=>\s*\{?|console\.(log|error|warn)\(|import\s+.*\s+from\s+['"].*['"]|export\s+(default\s+)?(function|class|const|let)|interface\s+[a-zA-Z0-9_$]+\s*\{|type\s+[a-zA-Z0-9_$]+\s*=)/.test(text)
  ) {
    if (/interface\s+[A-Z]|type\s+[A-Z].*=|<[A-Z][a-zA-Z0-9]*>|:\s*(string|number|boolean|any)\b/.test(text)) {
      return { isCode: true, language: 'TypeScript' };
    }
    return { isCode: true, language: 'JavaScript' };
  }

  // Shell / Bash
  if (/^#!\/bin\/(ba)?sh|npm\s+(install|run|test)|git\s+(commit|push|pull|checkout|status)|curl\s+-|docker\s+(run|build|ps)/m.test(text)) {
    return { isCode: true, language: 'Shell' };
  }

  // CSS
  if (/[.#][a-zA-Z0-9_-]+\s*\{[\s\S]*?[a-zA-Z-]+:\s*[^;]+;[\s\S]*?\}/.test(text)) {
    return { isCode: true, language: 'CSS' };
  }

  // Generic code indicators (curls with semicolons or arrows)
  const codeLines = text.split('\n');
  if (codeLines.length > 1) {
    const hasIndents = codeLines.some((l) => l.startsWith('  ') || l.startsWith('\t'));
    const hasSyntaxSymbols = /[{}();=><]/.test(text);
    if (hasIndents && hasSyntaxSymbols) {
      return { isCode: true, language: 'Code' };
    }
  }

  return { isCode: false };
}
