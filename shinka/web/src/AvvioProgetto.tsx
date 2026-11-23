/**
 * Nella scheda della proposta di un progetto: con quali estensioni nasce, e con quale skill
 * comincia il primo messaggio. Le estensioni di Shinka si scelgono per il progetto; quelle che il
 * proprietario ha installato nell'ambiente per conto suo ci sono sempre, e si vedono soltanto.
 */

import { useId, type ReactNode } from "react";
import {
  consigliateMancanti,
  PLUGIN_DELLE_SKILL_DI_PARTENZA,
  SKILL_DI_PARTENZA,
  SPIEGAZIONE_SKILL,
  type EstensioniPerProgetto,
  type SkillDiPartenza,
} from "../../src/protocollo/avvio-progetto.ts";

/** Ciò che il proprietario sceglie nella scheda per la skill: una delle due, nessuna, o quella consigliata. */
export type SceltaSkill = SkillDiPartenza | "nessuna";

export function SceltaEstensioni({
  disponibili,
  nomeAmbiente,
  scelte,
  disattivo,
  allaScelta,
}: {
  disponibili: EstensioniPerProgetto | undefined;
  nomeAmbiente: string;
  scelte: readonly string[];
  disattivo: boolean;
  allaScelta: (nome: string, scelta: boolean) => void;
}): ReactNode {
  const voci = disponibili?.voci ?? [];
  const mancanti = consigliateMancanti(voci);
  const diShinka = voci.filter((voce) => voce.provenienza === "shinka");
  const dellAmbiente = voci.filter((voce) => voce.provenienza === "ambiente");
  return (
    <div className="voce-scheda estensioni-progetto">
      <div className="titolino">Estensioni del progetto</div>
      {diShinka.length === 0 && dellAmbiente.length === 0 && <div className="tenue">In «{nomeAmbiente}» non ci sono estensioni.</div>}
      {diShinka.map((voce) => (
        <label key={voce.nome} className={voce.accesa ? "spunta" : "spunta spenta"}>
          <input
            type="checkbox"
            checked={voce.accesa && scelte.includes(voce.nome)}
            disabled={disattivo || !voce.accesa}
            onChange={(evento) => allaScelta(voce.nome, evento.target.checked)}
          />
          <span>
            <span>
              <span className="nome-estensione">{voce.nome}</span>
              <span className="genere-estensione"> · {voce.genere === "plugin" ? "plugin" : "server MCP"}</span>
            </span>
            {!voce.accesa && <span className="nota-estensione">Spenta in «{nomeAmbiente}»: si accende dalla pagina Estensioni.</span>}
            {voce.accesa && voce.preparazione !== undefined && (
              <span className="nota-estensione">Alla nascita del progetto Shinka ne costruisce l'indice nella cartella.</span>
            )}
          </span>
        </label>
      ))}
      {dellAmbiente.map((voce) => (
        <label key={voce.nome} className="spunta">
          <input type="checkbox" checked disabled />
          <span>
            <span>
              <span className="nome-estensione">{voce.nome}</span>
              <span className="genere-estensione"> · {voce.genere === "plugin" ? "plugin" : "server MCP"}</span>
            </span>
            <span className="nota-estensione">Installata in «{nomeAmbiente}» per conto tuo: c'è sempre.</span>
          </span>
        </label>
      ))}
      {mancanti.map((nome) => (
        <div key={nome} className="avvertenza">
          «{nome}» non c'è in «{nomeAmbiente}»: il progetto nascerebbe senza.
        </div>
      ))}
      {disponibili !== undefined && disponibili.guardatoIl === undefined && (
        <div className="tenue">
          Ciò che hai installato in «{nomeAmbiente}» per conto tuo Shinka non l'ha ancora guardato: lo fa dalla pagina Estensioni.
        </div>
      )}
    </div>
  );
}

export function SceltaSkillDiPartenza({
  scelta,
  consigliata,
  disponibile,
  disattivo,
  allaScelta,
}: {
  /** La skill effettiva: undefined se il progetto comincia dal solo brief. */
  scelta: SkillDiPartenza | undefined;
  consigliata: SkillDiPartenza;
  /** Falso se il progetto non avrebbe il plugin delle skill. */
  disponibile: boolean;
  disattivo: boolean;
  allaScelta: (scelta: SceltaSkill) => void;
}): ReactNode {
  const id = useId();
  return (
    <div className="voce-scheda">
      <label htmlFor={id}>Come comincia</label>
      <select
        id={id}
        value={disponibile ? (scelta ?? "nessuna") : "nessuna"}
        disabled={disattivo || !disponibile}
        onChange={(evento) => allaScelta(evento.target.value as SceltaSkill)}
      >
        {SKILL_DI_PARTENZA.map((skill) => (
          <option key={skill} value={skill}>
            {skill === consigliata ? `${skill} (consigliata)` : skill}
          </option>
        ))}
        <option value="nessuna">Dal solo brief</option>
      </select>
      <div className="tenue">
        {!disponibile
          ? `Le skill di partenza vengono dal plugin ${PLUGIN_DELLE_SKILL_DI_PARTENZA}: senza, il progetto comincia dal solo brief.`
          : scelta === undefined
            ? "Il primo messaggio è il brief, così com'è."
            : `${SPIEGAZIONE_SKILL[scelta]} Il primo messaggio è il brief, preceduto da /${PLUGIN_DELLE_SKILL_DI_PARTENZA}:${scelta}.`}
      </div>
    </div>
  );
}
