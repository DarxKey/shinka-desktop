/**
 * Il colore della sintassi nei blocchi di codice, con highlight.js e i soli linguaggi che
 * servono: questo modulo si carica quando nella chat compare il primo blocco di codice.
 */

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LINGUAGGI = { bash, c, cpp, csharp, css, diff, dockerfile, go, ini, java, javascript, json, markdown, powershell, python, rust, sql, typescript, xml, yaml };
for (const [nome, definizione] of Object.entries(LINGUAGGI)) hljs.registerLanguage(nome, definizione);
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["js", "jsx", "mjs"], { languageName: "javascript" });
hljs.registerAliases(["sh", "shell", "zsh", "console"], { languageName: "bash" });
hljs.registerAliases(["html", "svg"], { languageName: "xml" });
hljs.registerAliases(["yml"], { languageName: "yaml" });
hljs.registerAliases(["ps1", "pwsh"], { languageName: "powershell" });
hljs.registerAliases(["py"], { languageName: "python" });
hljs.registerAliases(["toml"], { languageName: "ini" });

/** Il codice in HTML con i colori della sintassi; undefined per un linguaggio che non conosce. */
export function evidenzia(codice: string, linguaggio: string): string | undefined {
  if (linguaggio === "" || hljs.getLanguage(linguaggio) === undefined) return undefined;
  // highlight.js scrive il codice con i caratteri speciali già protetti: l'HTML che esce è solo il suo.
  return hljs.highlight(codice, { language: linguaggio, ignoreIllegals: true }).value;
}
