/** Preparazione, nel browser, dei file che il proprietario allega a un messaggio. */

import {
  ALLEGATI_MASSIMI,
  eImmagine,
  PESO_MASSIMO_ALLEGATI,
  type Allegato,
} from "../../src/protocollo/allegati.ts";

/** Oltre questo lato un'immagine viene rimpicciolita: una foto del telefono pesa troppo e non serve intera. */
const LATO_MASSIMO_PX = 2000;

/** Sotto questo peso un'immagine di un tipo già adatto viaggia così com'è. */
const PESO_SENZA_RITOCCHI = 1_500_000;

/** Che cosa non va in una scelta di allegati; nulla se va bene. */
export function difettoDegliAllegati(quanti: number, pesoInBase64: number): string | undefined {
  if (quanti > ALLEGATI_MASSIMI) return `Si possono allegare al massimo ${ALLEGATI_MASSIMI} file per messaggio.`;
  if (pesoInBase64 > PESO_MASSIMO_ALLEGATI) return "Gli allegati pesano troppo: in tutto al massimo 9 MB circa.";
  return undefined;
}

/** Legge i file scelti e li prepara al viaggio. Le immagini grandi vengono rimpicciolite. */
export async function preparaAllegati(file: File[]): Promise<Allegato[]> {
  return Promise.all(file.map(preparaAllegato));
}

async function preparaAllegato(file: File): Promise<Allegato> {
  const tipo = file.type === "" ? "application/octet-stream" : file.type;
  if (tipo.startsWith("image/") && (!eImmagine(tipo) || file.size > PESO_SENZA_RITOCCHI)) {
    const ridotta = await rimpicciolisci(file);
    if (ridotta !== undefined) {
      return { nome: file.name.replace(/\.[^.]+$/, "") + ".jpg", tipo: "image/jpeg", dati: await inBase64(ridotta) };
    }
  }
  return { nome: file.name, tipo, dati: await inBase64(file) };
}

/** Ridisegna l'immagine entro il lato massimo, in JPEG. Nulla se il browser non sa leggerla. */
async function rimpicciolisci(file: File): Promise<Blob | undefined> {
  try {
    const immagine = await createImageBitmap(file);
    const scala = Math.min(1, LATO_MASSIMO_PX / Math.max(immagine.width, immagine.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(immagine.width * scala);
    tela.height = Math.round(immagine.height * scala);
    const contesto = tela.getContext("2d");
    if (contesto === null) return undefined;
    // Sfondo bianco: una trasparenza diventerebbe nera in JPEG.
    contesto.fillStyle = "#ffffff";
    contesto.fillRect(0, 0, tela.width, tela.height);
    contesto.drawImage(immagine, 0, 0, tela.width, tela.height);
    immagine.close();
    return await new Promise((risolvi) => tela.toBlob((blob) => risolvi(blob ?? undefined), "image/jpeg", 0.85));
  } catch {
    return undefined;
  }
}

function inBase64(contenuto: Blob): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error("Il file non si riesce a leggere."));
    lettore.onload = () => {
      const indirizzo = String(lettore.result);
      // Un indirizzo di dati ha la forma "data:tipo;base64,contenuto": serve solo il contenuto.
      risolvi(indirizzo.slice(indirizzo.indexOf(",") + 1));
    };
    lettore.readAsDataURL(contenuto);
  });
}
