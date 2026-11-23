/**
 * Le formule nelle risposte, con KaTeX: questo modulo si carica quando una risposta ne contiene.
 * `$...$` vale come formula solo se c'è qualcosa da formula (barra rovesciata, apici, pedici,
 * graffe): così "costa $5 o $10" resta testo.
 */

import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export const pluginRemark = [[remarkMath, { singleDollarTextMath: true }]] as const;
export const pluginRehype = [[rehypeKatex, { throwOnError: false, strict: "ignore" }]] as const;
