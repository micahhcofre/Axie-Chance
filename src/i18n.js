// Infraestructura de internacionalización (i18n).
// Módulo puro: no accede a document ni window al cargarse, ya que game.js lo
// importa también en Node para el servidor de salas.
import { EN_STRINGS } from './i18n-en.js';

export const LANG_KEY = 'axie-chance:lang';
export const LANGS = ['es', 'en'];

/**
 * Idioma del dispositivo: el primero de `navigator.languages` (o `navigator.language`)
 * cuya base ('es' de 'es-AR', 'en' de 'en-US') esté en LANGS. Si el dispositivo no
 * habla ninguno de los nuestros, inglés.
 */
export function deviceLang() {
  try {
    const nav = globalThis.navigator;
    const tags = nav?.languages?.length ? nav.languages : [nav?.language];
    for (const tag of tags) {
      const base = String(tag ?? '').toLowerCase().split('-')[0];
      if (LANGS.includes(base)) return base;
    }
  } catch {
    // sin navigator no hay dispositivo que consultar
  }
  return 'en';
}

/**
 * Devuelve el idioma actual ('es' o 'en'): el guardado en localStorage y, si no hay
 * uno válido, el del dispositivo (`deviceLang`, con inglés de respaldo). Sin `document`
 * no hay pantalla —es el servidor de salas en Node— y habla en español: preguntarle a
 * Node por su `localStorage` experimental solo deja un aviso en la consola.
 */
export function currentLang() {
  if (!globalThis.document) return 'es';
  try {
    const lang = globalThis.localStorage?.getItem(LANG_KEY);
    return LANGS.includes(lang) ? lang : deviceLang();
  } catch {
    return deviceLang();
  }
}

/** Guarda el idioma seleccionado en localStorage. */
export function setLang(lang) {
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang);
  } catch {
    // ignorar fallos de almacenamiento
  }
}

/**
 * Traduce un texto al idioma activo reemplazando parámetros {clave}.
 * Si el idioma es 'en' y existe la traducción en EN_STRINGS, la devuelve;
 * si no, devuelve el texto original en español como fallback.
 */
export function tr(text, params) {
  let res = (currentLang() === 'en' && EN_STRINGS[text] !== undefined)
    ? EN_STRINGS[text]
    : text;
  if (params && typeof params === 'object') {
    res = res.replace(/\{([^}]+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
  return res;
}

/**
 * Recorre recursivamente childNodes traduciendo nodos de texto y atributos
 * title, aria-label, alt y placeholder para el HTML estático.
 * Solo actúa si el idioma actual es 'en'.
 */
export function translateDom(root) {
  if (currentLang() !== 'en' || !root) return;

  const tag = root.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE') return;

  const ATTRS = ['title', 'aria-label', 'alt', 'placeholder'];
  if (typeof root.getAttribute === 'function' && typeof root.setAttribute === 'function') {
    for (const attr of ATTRS) {
      const val = root.getAttribute(attr);
      if (val && typeof val === 'string') {
        const trimmed = val.trim().replace(/\s+/g, ' ');
        if (trimmed && EN_STRINGS[trimmed] !== undefined) {
          root.setAttribute(attr, EN_STRINGS[trimmed]);
        }
      }
    }
  }

  if (root.nodeType === 3) {
    const text = root.textContent;
    if (text && typeof text === 'string') {
      const trimmed = text.trim().replace(/\s+/g, ' ');
      if (trimmed && EN_STRINGS[trimmed] !== undefined) {
        const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
        const leading = match ? match[1] : '';
        const trailing = match ? match[3] : '';
        root.textContent = leading + EN_STRINGS[trimmed] + trailing;
      }
    }
    return;
  }

  const children = root.childNodes || root.children || [];
  // Soporte para nodos hoja en shims de test sin textNodes reales
  if (children.length === 0 && root.textContent && typeof root.textContent === 'string') {
    const text = root.textContent;
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed && EN_STRINGS[trimmed] !== undefined) {
      const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const leading = match ? match[1] : '';
      const trailing = match ? match[3] : '';
      root.textContent = leading + EN_STRINGS[trimmed] + trailing;
    }
  }

  for (let i = 0; i < children.length; i++) {
    translateDom(children[i]);
  }
}

export { EN_STRINGS };
