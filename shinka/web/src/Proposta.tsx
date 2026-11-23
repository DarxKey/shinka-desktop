import { useId, useState, type ReactNode } from "react";
import { BRIEF_MASSIMO, nomeCartellaDa, type NuovoProgettoAMano } from "../../src/protocollo/progetti.ts";
import { annullaProposta, confermaProposta } from "./api.ts";
import type { Impegno, ImpostazioniConversazione, ModoPermessi, Motore } from "../../src/protocollo/impostazioni.ts";
import { SceltaImpostazioni } from "./SceltaImpostazioni.tsx";
import { SceltaEstensioni, SceltaSkillDiPartenza, type SceltaSkill } from "./AvvioProgetto.tsx";
import { haLeSkillDiPartenza, sceltePredefinite, skillPredefinita } from "../../src/protocollo/avvio-progetto.ts";
import { cartellaPrevista, sottotitoloAmbiente } from "./descrivi.ts";
import { useQuadroCorrente } from "./Quadro.tsx";
import type { Elemento } from "./stato.ts";
import { frammentoDi, vaiA } from "./vista.ts";

type Proposta = Extract<Elemento, { tipo: "proposta" }>;

/** La scheda con cui la Home propone un progetto: nulla nasce finché il proprietario non conferma. */
export function SchedaProposta({ proposta }: { proposta: Proposta }): ReactNode {
  if (proposta.esito === "annullata") {
    return (
      <div className="riga nota">
        Proposta annullata: il progetto «{proposta.nome}» non è stato creato.
      </div>
    );
  }
  if (proposta.esito === "confermata") return <PropostaConfermata proposta={proposta} />;
  return <PropostaInAttesa proposta={proposta} />;
}

function PropostaConfermata({ proposta }: { proposta: Proposta }): ReactNode {
  const { progetti } = useQuadroCorrente();
  const progetto = progetti?.progetti.find((p) => p.id === proposta.idProgetto);
  const nome = progetto?.nome ?? proposta.nomeProgetto ?? proposta.nome;
  return (
    <div className="riga proposta decisa">
      <div className="testo">
        <div className="intestazione">Progetto creato: {nome}</div>
        {progetto !== undefined && <div className="tenue">{progetto.nomeAmbiente}</div>}
        {proposta.cartellaAdottata !== undefined && (
          <div className="tenue">
            Nella cartella che esisteva già: {proposta.cartellaAdottata.percorso}
            {!proposta.cartellaAdottata.git && ". Non è un repository Git, e Shinka non l'ha inizializzato."}
          </div>
        )}
        {(proposta.estensioniScelte !== undefined || proposta.skillDiPartenza !== undefined) && (
          <div className="tenue">
            {proposta.estensioniScelte === undefined || proposta.estensioniScelte.length === 0
              ? "Senza estensioni di Shinka"
              : `Con ${proposta.estensioniScelte.join(", ")}`}
            {proposta.skillDiPartenza === undefined ? "" : ` · comincia con ${proposta.skillDiPartenza}`}
          </div>
        )}
        {proposta.filePortati !== undefined && (
          <div className="tenue">
            {proposta.filePortati === 1
              ? "Nato con una copia di un file dell'argomento"
              : `Nato con una copia di ${proposta.filePortati} file dell'argomento`}
          </div>
        )}
      </div>
      {proposta.idProgetto !== undefined && (
        <a className="pulsante" href={frammentoDi({ tipo: "progetto", id: proposta.idProgetto })}>
          Apri
        </a>
      )}
    </div>
  );
}

/** Quando la scheda non viene da una proposta della Home: il proprietario crea il progetto da sé, e scrive anche il brief. */
export interface CreazioneAMano {
  /** Crea il progetto e ne restituisce l'identificativo. */
  crea(nuovo: NuovoProgettoAMano): Promise<string>;
  annulla(): void;
}

/**
 * La scheda di un progetto che sta per nascere: nome, ambiente, cartella, impostazioni, estensioni
 * e brief. La Home la riempie con una proposta; con `aMano` la riempie il proprietario.
 */
export function PropostaInAttesa({ proposta, aMano }: { proposta: Omit<Proposta, "tipo">; aMano?: CreazioneAMano }): ReactNode {
  const { ambienti } = useQuadroCorrente();
  const idBrief = useId();
  const [brief, setBrief] = useState(proposta.brief);
  const idNome = useId();
  const idAmbienteCampo = useId();
  const idCartellaCampo = useId();
  const [portaFile, setPortaFile] = useState(true);
  // Vuota: il progetto nasce in una cartella nuova, come sempre. Piena: nasce in quella che c'è già.
  const [cartellaEsistente, setCartellaEsistente] = useState(proposta.cartellaEsistente ?? "");
  // Le impostazioni con cui il progetto nasce: si parte da quelle di un progetto nuovo.
  const predefinite: ImpostazioniConversazione = proposta.impostazioni ?? { permessi: "modifiche-libere" };
  const [motore, setMotore] = useState<Motore | undefined>(predefinite.motore);
  const [modello, setModello] = useState(predefinite.modello ?? "");
  const [impegno, setImpegno] = useState<Impegno | "">(predefinite.impegno ?? "");
  const [permessi, setPermessi] = useState<ModoPermessi>(predefinite.permessi);
  const [nome, setNome] = useState(proposta.nome);
  const [idAmbiente, setIdAmbiente] = useState(proposta.idAmbiente);
  // Le estensioni scelte, per ambiente: cambiando ambiente si ritrova ciò che si era scelto lì.
  const [estensioniScelte, setEstensioniScelte] = useState<Record<string, string[]>>({});
  // Undefined finché il proprietario non tocca la scelta: vale quella consigliata, che segue la cartella.
  const [sceltaSkill, setSceltaSkill] = useState<SceltaSkill>();
  const [inCorso, setInCorso] = useState<"conferma" | "annullamento">();
  const [errore, setErrore] = useState<string>();

  const elenco = ambienti?.ambienti ?? [];
  const scelto = elenco.find((a) => a.id === idAmbiente);
  const nomePulito = nome.trim();
  const occupata = inCorso !== undefined;
  const puoConfermare = !occupata && nomePulito !== "" && scelto?.attivo === true && (aMano === undefined || brief.trim() !== "");
  const esistente = cartellaEsistente.trim();
  // L'avviso della Home vale per la cartella che aveva guardato lei, nell'ambiente proposto.
  const avvisoValido =
    proposta.avvisoCartella !== undefined && esistente === proposta.cartellaEsistente && idAmbiente === proposta.idAmbiente;
  // Un progetto nasce con i file del proprio ambiente: quelli che l'argomento ha altrove restano lì.
  // In una cartella che esiste già non si copia nulla.
  const fileQui = esistente === "" ? proposta.file?.find((voce) => voce.idAmbiente === idAmbiente) : undefined;
  const fileAltrove = (proposta.file ?? []).filter((voce) => voce.idAmbiente !== idAmbiente);
  const nomeAmbiente = (id: string): string => elenco.find((a) => a.id === id)?.nome ?? id;
  // Le estensioni ci sono solo nelle proposte fatte da una Shinka che le sa scegliere.
  const disponibili = proposta.estensioni?.[idAmbiente];
  const sceltePerQui = estensioniScelte[idAmbiente] ?? sceltePredefinite(disponibili?.voci ?? []);
  const conLeSkill = haLeSkillDiPartenza(disponibili?.voci ?? [], sceltePerQui);
  const consigliata = skillPredefinita(esistente);
  const skill = !conLeSkill || sceltaSkill === "nessuna" ? undefined : (sceltaSkill ?? consigliata);
  const scegliEstensione = (nome: string, scelta: boolean): void =>
    setEstensioniScelte((prima) => ({
      ...prima,
      [idAmbiente]: scelta ? [...sceltePerQui.filter((una) => una !== nome), nome] : sceltePerQui.filter((una) => una !== nome),
    }));

  async function conferma(): Promise<void> {
    setInCorso("conferma");
    setErrore(undefined);
    try {
      const scelte = {
        nome: nomePulito,
        idAmbiente,
        // Vuota vale anche se la Home ne aveva proposta una: il proprietario vuole una cartella nuova.
        ...(esistente === "" && proposta.cartellaEsistente === undefined ? {} : { cartellaEsistente: esistente }),
        // Si manda solo ciò che il proprietario ha cambiato.
        ...(motore !== predefinite.motore ? { motore: motore ?? null } : {}),
        ...(modello !== (predefinite.modello ?? "") ? { modello: modello === "" ? null : modello } : {}),
        ...(impegno !== (predefinite.impegno ?? "") ? { impegno: impegno === "" ? null : impegno } : {}),
        ...(permessi !== predefinite.permessi ? { permessi } : {}),
        ...(proposta.estensioni === undefined ? {} : { estensioni: sceltePerQui, skillDiPartenza: skill ?? null }),
      };
      const idProgetto =
        aMano === undefined
          ? await confermaProposta(proposta.chiave, { ...scelte, ...(fileQui === undefined ? {} : { portaFile }) })
          : await aMano.crea({ ...scelte, brief: brief.trim() });
      // Il progetto è nato: l'interfaccia si sposta lì, dove il lavoro comincia dal solo brief.
      vaiA({ tipo: "progetto", id: idProgetto });
    } catch (causa) {
      setInCorso(undefined);
      setErrore(causa instanceof Error ? causa.message : "Il progetto non è stato creato.");
    }
  }

  async function annulla(): Promise<void> {
    if (aMano !== undefined) return aMano.annulla();
    setInCorso("annullamento");
    setErrore(undefined);
    try {
      await annullaProposta(proposta.chiave);
    } catch (causa) {
      setInCorso(undefined);
      setErrore(causa instanceof Error ? causa.message : "Proposta non annullata.");
    }
  }

  return (
    <div className="riga proposta" role="group" aria-label={aMano === undefined ? "Proposta di progetto" : "Nuovo progetto"}>
      <div className="intestazione">{aMano === undefined ? "Proposta di progetto" : "Nuovo progetto"}</div>

      <div className="voce-scheda">
        <label htmlFor={idNome}>Nome</label>
        <input
          id={idNome}
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder={aMano === undefined ? undefined : "Due o tre parole"}
          value={nome}
          disabled={occupata}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </div>

      <div className="voce-scheda">
        <label htmlFor={idAmbienteCampo}>Ambiente</label>
        <select
          id={idAmbienteCampo}
          value={idAmbiente}
          disabled={occupata || ambienti === undefined}
          onChange={(evento) => setIdAmbiente(evento.target.value)}
        >
          {scelto === undefined && (
            <option value={idAmbiente} disabled>
              {ambienti === undefined ? "Carico…" : "non più disponibile"}
            </option>
          )}
          {elenco.map((ambiente) => (
            <option key={ambiente.id} value={ambiente.id} disabled={!ambiente.attivo}>
              {ambiente.attivo ? ambiente.nome : `${ambiente.nome} (spento)`}
            </option>
          ))}
        </select>
        {scelto !== undefined && (
          <div className="tenue">{sottotitoloAmbiente(scelto.sistema, scelto.descrizione)}</div>
        )}
        {ambienti !== undefined && scelto?.attivo !== true && (
          <div className="errore">
            {scelto === undefined
              ? aMano === undefined
                ? "L'ambiente proposto non c'è più: scegline uno attivo."
                : "Scegli un ambiente attivo."
              : `«${scelto.nome}» è spento: scegli un ambiente attivo, oppure riaccendilo.`}
          </div>
        )}
      </div>

      <div className="voce-scheda">
        <label htmlFor={idCartellaCampo}>Cartella che esiste già</label>
        <input
          id={idCartellaCampo}
          type="text"
          maxLength={1000}
          autoComplete="off"
          spellCheck={false}
          placeholder="Vuoto: una cartella nuova"
          value={cartellaEsistente}
          disabled={occupata}
          onChange={(evento) => setCartellaEsistente(evento.target.value)}
        />
        {esistente === "" ? (
          <>
            <div className="tenue">Il progetto nasce in una cartella nuova:</div>
            <code className="percorso">
              {scelto === undefined
                ? nomeCartellaDa(nomePulito)
                : cartellaPrevista(scelto.radiceProgetti, nomeCartellaDa(nomePulito))}
            </code>
          </>
        ) : (
          <div className="tenue">
            Il progetto lavora in questa cartella così com'è: Shinka non la copia, non ci scrive e non ne fa un repository
            Git. Alla conferma controlla che esista in «{scelto?.nome ?? idAmbiente}».
          </div>
        )}
        {avvisoValido && <div className="avvertenza">{proposta.avvisoCartella}</div>}
      </div>

      {proposta.file !== undefined && esistente === "" && (
        <div className="voce-scheda file-argomento">
          <div className="titolino">File già prodotti in questo argomento</div>
          {fileQui !== undefined && (
            <>
              <label className="spunta">
                <input
                  type="checkbox"
                  checked={portaFile}
                  disabled={occupata}
                  onChange={(evento) => setPortaFile(evento.target.checked)}
                />
                <span>
                  {fileQui.quanti === 1
                    ? "Il progetto nasce con una copia di questo file"
                    : `Il progetto nasce con una copia di questi ${fileQui.quanti} file`}
                </span>
              </label>
              <ul className="elenco-file">
                {fileQui.percorsi.map((percorso) => (
                  <li key={percorso}>{percorso}</li>
                ))}
                {fileQui.quanti > fileQui.percorsi.length && (
                  <li className="tenue">e altri {fileQui.quanti - fileQui.percorsi.length}</li>
                )}
              </ul>
            </>
          )}
          {fileAltrove.map((voce) => (
            <div key={voce.idAmbiente} className={fileQui === undefined ? "avvertenza" : "tenue"}>
              {voce.quanti === 1 ? "Un file è" : `${voce.quanti} file sono`} in «{nomeAmbiente(voce.idAmbiente)}»
              {fileQui === undefined
                ? ": un progetto nasce con i soli file del suo ambiente, quindi qui nascerebbe dal solo brief."
                : ": restano lì."}
            </div>
          ))}
        </div>
      )}

      {proposta.impostazioni !== undefined && (
        <div className="voce-scheda">
          <div className="titolino">Con quali impostazioni nasce</div>
          <SceltaImpostazioni
            modelli={proposta.modelli}
            motore={motore}
            modello={modello}
            impegno={impegno}
            permessi={permessi}
            disattivo={occupata}
            alModello={(scelta) => {
              if (scelta.motore !== undefined) setMotore(scelta.motore);
              setModello(scelta.modello ?? "");
            }}
            allImpegno={setImpegno}
            aiPermessi={setPermessi}
          />
          <div className="tenue">Restano quelle del progetto: le cambi quando vuoi, sotto il campo della sua chat.</div>
          {permessi === "senza-permessi" && (
            <div className="avvertenza">Senza permessi il progetto esegue qualunque comando senza chiederti nulla, anche fuori dalla sua cartella.</div>
          )}
        </div>
      )}

      {proposta.estensioni !== undefined && (
        <>
          <SceltaEstensioni
            disponibili={disponibili}
            nomeAmbiente={scelto?.nome ?? idAmbiente}
            scelte={sceltePerQui}
            disattivo={occupata}
            allaScelta={scegliEstensione}
          />
          <SceltaSkillDiPartenza
            scelta={skill}
            consigliata={consigliata}
            disponibile={conLeSkill}
            disattivo={occupata}
            allaScelta={setSceltaSkill}
          />
        </>
      )}

      <div className="voce-scheda">
        {aMano === undefined ? (
          <>
            <div className="titolino">Brief: tutto ciò che il progetto saprà all'inizio</div>
            <div className="brief">{proposta.brief}</div>
          </>
        ) : (
          <>
            <label htmlFor={idBrief}>Brief: tutto ciò che il progetto saprà all'inizio</label>
            <textarea
              id={idBrief}
              className="brief-a-mano"
              rows={8}
              maxLength={BRIEF_MASSIMO}
              placeholder="Che cosa va fatto, con quali vincoli, e come si capisce che è finito. Il progetto comincia a lavorare da qui, senza sapere altro."
              value={brief}
              disabled={occupata}
              onChange={(evento) => setBrief(evento.target.value)}
            />
            <div className="tenue">Alla creazione il progetto riceve questo testo come primo messaggio, e comincia subito a lavorare.</div>
          </>
        )}
      </div>

      <div className="pulsanti">
        <button type="button" className="approva" disabled={!puoConfermare} onClick={() => void conferma()}>
          {inCorso === "conferma" ? "Creo il progetto…" : aMano === undefined ? "Conferma" : "Crea il progetto"}
        </button>
        <button type="button" disabled={occupata} onClick={() => void annulla()}>
          Annulla
        </button>
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
