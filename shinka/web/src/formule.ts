/** Vero se in un testo c'è una formula da disegnare: `$$...$$`, oppure `$...$` con dentro qualcosa da formula. */
export function haFormule(testo: string): boolean {
  return /\$\$[\s\S]+?\$\$/.test(testo) || /(^|[^\\$])\$(?!\s)[^$\n]*[\\^_{}][^$\n]*\$/.test(testo);
}
