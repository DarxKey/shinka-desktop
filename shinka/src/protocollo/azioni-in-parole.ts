/**
 * Le azioni di Claude in poche parole: come si chiama ciò che sta facendo, e su che cosa.
 * Lo usano l'interfaccia, per le righe delle azioni e le schede dei permessi, e il centro,
 * per dire al proprietario su Telegram che cosa gli viene chiesto di consentire.
 */

const ETICHETTE: Record<string, string> = {
  Bash: "Comando",
  // Su Windows i comandi di Claude Code passano da PowerShell.
  PowerShell: "Comando",
  Read: "Lettura",
  Write: "Scrittura",
  Edit: "Modifica",
  NotebookEdit: "Modifica",
  Glob: "Ricerca di file",
  Grep: "Ricerca nel testo",
  WebSearch: "Ricerca sul web",
  WebFetch: "Pagina web",
  ToolSearch: "Ricerca di uno strumento",
  Agent: "Subagent",
  Task: "Subagent",
  Skill: "Skill",
  TodoWrite: "Elenco dei compiti",
  mcp__shinka__elenca_ambienti: "Ambienti",
  mcp__shinka__elenca_progetti: "Progetti",
  mcp__shinka__proponi_progetto: "Proposta di progetto",
  mcp__shinka__apri_progetto: "Apertura del progetto",
  mcp__shinka__leggi_progetto: "Stato del progetto",
  mcp__shinka__inoltra_a_progetto: "Inoltro al progetto",
  // Le azioni in un altro ambiente si chiamano come quelle fatte qui: l'ambiente sta nel dettaglio.
  mcp__shinka__esegui_in_ambiente: "Comando",
  mcp__shinka__scrivi_file: "Scrittura",
  mcp__shinka__leggi_file: "Lettura",
  mcp__shinka__chiedi_dove_lavorare: "Domanda su dove lavorare",
  mcp__shinka__cambia_argomento: "Cambio di argomento",
  mcp__shinka__cerca_argomenti: "Ricerca tra gli argomenti",
  mcp__shinka__leggi_argomento: "Rilettura di un argomento",
  mcp__shinka__ricorda: "Annotazione in memoria",
  mcp__shinka__correggi_memoria: "Correzione della memoria",
  mcp__shinka__dimentica: "Cancellazione dalla memoria",
  mcp__shinka__leggi_skill: "Lettura delle skill",
  mcp__shinka__salva_skill: "Skill creata o migliorata",
  mcp__shinka__programma_lavoro: "Lavoro programmato proposto",
  mcp__shinka__elenca_programmati: "Lavori programmati",
  mcp__shinka__togli_programmato: "Lavoro programmato tolto",
  mcp__shinka__elenca_credenziali: "Credenziali del vault",
  mcp__shinka__leggi_credenziale: "Lettura di una credenziale in chiaro",
  mcp__shinka__salva_credenziale_in_chiaro: "Credenziale in chiaro proposta",
  mcp__shinka__esegui_su_host: "Comando su un host",
  mcp__shinka__apri_sito: "Apertura di un sito",
  mcp__shinka__leggi_sito: "Lettura della pagina",
  mcp__shinka__agisci_nel_sito: "Azione nel sito",
  mcp__shinka__inserisci_credenziale: "Accesso con una credenziale",
  mcp__shinka__chiudi_sito: "Pagina chiusa",
  mcp__shinka__proponi_anteprima: "Anteprima proposta",
  mcp__shinka__imposta_anteprima: "Avvio dell'anteprima",
  mcp__shinka__avvia_anteprima: "Anteprima avviata",
  mcp__shinka__ferma_anteprima: "Anteprima fermata",
  mcp__shinka__stato_anteprima: "Stato dell'anteprima",
  mcp__shinka__proponi_sviluppo: "Proposta di sviluppo di Shinka",
  mcp__shinka__chiedi_installazione: "Prove e richiesta di installazione",
  mcp__shinka__aggiorna_gateway: "Versione proposta al gateway",
  mcp__shinka__proponi_estensione: "Proposta di un'estensione",
  mcp__shinka__elenca_estensioni: "Estensioni",
  mcp__shinka__elenca_stack: "Stack di prova",
  mcp__shinka__avvia_stack: "Avvio di uno stack",
  mcp__shinka__leggi_stack: "Stato di uno stack",
  mcp__shinka__ferma_stack: "Arresto di uno stack",
  mcp__shinka__rimuovi_stack: "Rimozione di uno stack",
  mcp__shinka__cartelle_collegate: "Cartelle collegate",
  mcp__shinka__esegui_nella_collegata: "Comando nella cartella collegata",
  mcp__shinka__leggi_nella_collegata: "Lettura nella cartella collegata",
  mcp__shinka__scrivi_nella_collegata: "Scrittura nella cartella collegata",
  mcp__shinka__modifica_nella_collegata: "Modifica nella cartella collegata",
  mcp__shinka__affida_incarico: "Incarico a chi implementa",
};

/** Gli strumenti che agiscono su uno stack di prova: il dettaglio dice quale, e su quale host. */
const DI_UNO_STACK = new Set([
  "mcp__shinka__elenca_stack",
  "mcp__shinka__avvia_stack",
  "mcp__shinka__leggi_stack",
  "mcp__shinka__ferma_stack",
  "mcp__shinka__rimuovi_stack",
]);

/** Per ogni strumento, il campo dell'ingresso che dice di più su cosa sta facendo. */
const CAMPO_PRINCIPALE: Record<string, string> = {
  Bash: "command",
  PowerShell: "command",
  Read: "file_path",
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
  Glob: "pattern",
  Grep: "pattern",
  WebSearch: "query",
  WebFetch: "url",
  ToolSearch: "query",
  Agent: "description",
  Task: "description",
  Skill: "skill",
  mcp__shinka__proponi_progetto: "nome",
  mcp__shinka__proponi_estensione: "nome",
  mcp__shinka__apri_progetto: "progetto",
  mcp__shinka__leggi_progetto: "progetto",
  mcp__shinka__inoltra_a_progetto: "progetto",
  mcp__shinka__esegui_in_ambiente: "comando",
  mcp__shinka__scrivi_file: "percorso",
  mcp__shinka__leggi_file: "percorso",
  mcp__shinka__chiedi_dove_lavorare: "lavoro",
  mcp__shinka__cambia_argomento: "titolo",
  mcp__shinka__cerca_argomenti: "testo",
  mcp__shinka__leggi_argomento: "argomento",
  mcp__shinka__ricorda: "testo",
  mcp__shinka__correggi_memoria: "testo",
  mcp__shinka__dimentica: "voce",
  mcp__shinka__leggi_skill: "nome",
  mcp__shinka__salva_skill: "nome",
  mcp__shinka__esegui_su_host: "comando",
  mcp__shinka__apri_sito: "indirizzo",
  mcp__shinka__inserisci_credenziale: "credenziale",
  mcp__shinka__leggi_credenziale: "credenziale",
  mcp__shinka__programma_lavoro: "titolo",
  mcp__shinka__salva_credenziale_in_chiaro: "nome",
  mcp__shinka__esegui_nella_collegata: "comando",
  mcp__shinka__leggi_nella_collegata: "percorso",
  mcp__shinka__scrivi_nella_collegata: "percorso",
  mcp__shinka__modifica_nella_collegata: "percorso",
  mcp__shinka__affida_incarico: "incarico",
};

/** Gli strumenti che agiscono in un ambiente indicato per nome: il nome apre il dettaglio. */
const CON_AMBIENTE = new Set([
  "mcp__shinka__esegui_in_ambiente",
  "mcp__shinka__scrivi_file",
  "mcp__shinka__leggi_file",
]);

/** Come cominciano i nomi degli strumenti con cui un progetto usa il browser del PC, attraverso l'estensione. */
const PREFISSO_BROWSER_DEL_PC = "mcp__claude-in-chrome__";

/** Che cosa fa ciascuno di quegli strumenti, in parole. */
const NEL_BROWSER_DEL_PC: Record<string, string> = {
  navigate: "apertura di una pagina",
  computer: "azione nella pagina",
  form_input: "scrittura in un campo",
  find: "ricerca nella pagina",
  read_page: "lettura della pagina",
  get_page_text: "lettura della pagina",
  javascript_tool: "codice eseguito nella pagina",
  tabs_create_mcp: "scheda nuova",
  tabs_close_mcp: "chiusura di una scheda",
  tabs_context_mcp: "elenco delle schede",
  browser_batch: "più azioni insieme",
  file_upload: "caricamento di un file",
  upload_image: "caricamento di un'immagine",
  read_console_messages: "lettura della console",
  read_network_requests: "lettura delle richieste di rete",
  resize_window: "dimensione della finestra",
  gif_creator: "registrazione",
  list_connected_browsers: "elenco dei browser",
  select_browser: "scelta del browser",
  switch_browser: "scelta del browser",
};

/** I gesti dello strumento `computer`, in parole. */
const GESTI: Record<string, string> = {
  left_click: "clic",
  right_click: "clic destro",
  double_click: "doppio clic",
  triple_click: "triplo clic",
  left_click_drag: "trascinamento",
  type: "scrive",
  key: "tasto",
  scroll: "scorre",
  scroll_to: "scorre fino a",
  hover: "passa sopra",
  screenshot: "immagine della pagina",
  zoom: "ingrandimento",
  wait: "attesa",
};

export function etichettaDi(strumento: string): string {
  if (strumento.startsWith(PREFISSO_BROWSER_DEL_PC)) {
    const nome = strumento.slice(PREFISSO_BROWSER_DEL_PC.length);
    return `Browser del PC: ${NEL_BROWSER_DEL_PC[nome] ?? nome}`;
  }
  const noto = ETICHETTE[strumento];
  if (noto !== undefined) return noto;
  // Uno strumento di un server che non è di Shinka: di un'estensione, o dell'ambiente.
  const esterno = /^mcp__(.+?)__(.+)$/.exec(strumento);
  return esterno === null ? strumento : `${esterno[1]}: ${esterno[2]}`;
}

/** Quanto di ciò che viene mandato a uno strumento esterno si mostra in una riga. */
const INGRESSO_MOSTRATO = 400;

/**
 * Un'azione nel browser del PC in parole: quale pagina, quale gesto, quale testo. È ciò che il
 * proprietario legge prima di consentire, e lì Shinka non ha altro modo di far valere i suoi divieti.
 */
function nelBrowserDelPc(nome: string, campi: Record<string, unknown>): string {
  const scritto = (campo: string): string => (typeof campi[campo] === "string" ? (campi[campo] as string).trim() : "");
  const tra = (testo: string): string => `"${testo}"`;
  switch (nome) {
    case "navigate":
      return scritto("url");
    case "find":
      return scritto("query");
    case "form_input": {
      const valore = campi.value;
      return typeof valore === "string" ? tra(valore) : typeof valore === "boolean" || typeof valore === "number" ? String(valore) : "";
    }
    case "javascript_tool":
      return scritto("text");
    case "file_upload":
    case "upload_image":
      return Array.isArray(campi.paths) ? campi.paths.filter((percorso) => typeof percorso === "string").join(", ") : scritto("path");
    case "computer": {
      const gesto = scritto("action");
      const punto = Array.isArray(campi.coordinate) ? `nel punto ${campi.coordinate.join(", ")}` : scritto("ref");
      const parti = [GESTI[gesto] ?? gesto, scritto("text") === "" ? "" : tra(scritto("text")), punto];
      return parti.filter((parte) => parte !== "").join(" › ");
    }
    case "browser_batch": {
      if (!Array.isArray(campi.actions)) return "";
      // Ogni azione del gruppo va detta: consentire il gruppo le consente tutte.
      return campi.actions
        .map((azione: unknown) => {
          if (typeof azione !== "object" || azione === null) return "";
          const { name, input } = azione as { name?: unknown; input?: unknown };
          if (typeof name !== "string") return "";
          const dettaglio = typeof input === "object" && input !== null ? nelBrowserDelPc(name, input as Record<string, unknown>) : "";
          return dettaglio === "" ? (NEL_BROWSER_DEL_PC[name] ?? name) : `${NEL_BROWSER_DEL_PC[name] ?? name}: ${dettaglio}`;
        })
        .filter((riga) => riga !== "")
        .join("; ");
    }
    default:
      return "";
  }
}

/** Un'azione in un sito in parole: che cosa, su che cosa, con quale testo. */
function azioneNelSito(campi: Record<string, unknown>): string {
  const scritto = (nome: string): string => (typeof campi[nome] === "string" ? (campi[nome] as string).trim() : "");
  const parti = [scritto("azione"), scritto("descrizione") || scritto("elemento")];
  if (scritto("testo") !== "") parti.push(`"${scritto("testo")}"${campi.invio === true ? " e Invio" : ""}`);
  return parti.filter((parte) => parte !== "").join(" › ");
}

/** Lo strumento con cui Claude propone l'anteprima dell'applicazione di un progetto. */
export const STRUMENTO_ANTEPRIMA = "mcp__shinka__proponi_anteprima";

export function dettaglioDi(strumento: string, ingresso: unknown): string {
  if (strumento === STRUMENTO_ANTEPRIMA && typeof ingresso === "object" && ingresso !== null) {
    const { porta, percorso } = ingresso as Record<string, unknown>;
    if (typeof porta !== "number") return "";
    return `localhost:${porta}${typeof percorso === "string" && percorso !== "/" ? percorso : ""}`;
  }
  if (strumento.startsWith(PREFISSO_BROWSER_DEL_PC)) {
    if (typeof ingresso !== "object" || ingresso === null) return "";
    return nelBrowserDelPc(strumento.slice(PREFISSO_BROWSER_DEL_PC.length), ingresso as Record<string, unknown>);
  }
  if (strumento === "mcp__shinka__agisci_nel_sito" && typeof ingresso === "object" && ingresso !== null) {
    return azioneNelSito(ingresso as Record<string, unknown>);
  }
  if (strumento === "mcp__shinka__leggi_sito" && typeof ingresso === "object" && ingresso !== null) {
    return (ingresso as Record<string, unknown>).immagine === true ? "con l'immagine" : "";
  }
  if (DI_UNO_STACK.has(strumento)) {
    if (typeof ingresso !== "object" || ingresso === null) return "";
    const { nome, host } = ingresso as Record<string, unknown>;
    return [nome, host].filter((parte) => typeof parte === "string" && parte !== "").join(" su ");
  }
  const campo = CAMPO_PRINCIPALE[strumento];
  if (campo === undefined && ETICHETTE[strumento] === undefined && strumento.startsWith("mcp__") && typeof ingresso === "object" && ingresso !== null) {
    // Di uno strumento esterno Shinka non sa quale campo conta: mostra ciò che gli viene mandato.
    const scritto = Object.keys(ingresso).length === 0 ? "" : JSON.stringify(ingresso);
    return scritto.length > INGRESSO_MOSTRATO ? `${scritto.slice(0, INGRESSO_MOSTRATO)}…` : scritto;
  }
  if (campo === undefined || typeof ingresso !== "object" || ingresso === null) return "";
  const campi = ingresso as Record<string, unknown>;
  const valore = campi[campo];
  if (typeof valore !== "string") return "";
  if (strumento === "mcp__shinka__esegui_su_host") {
    // Con quale credenziale e su quale host: è ciò che il proprietario deve vedere prima di consentire.
    const dove = [campi.credenziale, campi.host].filter((parte) => typeof parte === "string" && parte !== "").join(" su ");
    return dove === "" ? valore : `${dove} › ${valore}`;
  }
  const ambiente = CON_AMBIENTE.has(strumento) ? campi.ambiente : undefined;
  return typeof ambiente === "string" && ambiente !== "" ? `${ambiente} › ${valore}` : valore;
}

/** Il comando che Claude chiede di eseguire su un host, per intero; nulla se l'azione non è quella. */
export function comandoSuHost(strumento: string, ingresso: unknown): string | undefined {
  if (strumento !== "mcp__shinka__esegui_su_host" || typeof ingresso !== "object" || ingresso === null) return undefined;
  const { comando } = ingresso as Record<string, unknown>;
  return typeof comando === "string" && comando !== "" ? comando : undefined;
}
