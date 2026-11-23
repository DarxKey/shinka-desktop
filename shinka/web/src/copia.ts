/** Copia un testo negli appunti; anche dove il browser non dà gli appunti moderni, come in HTTP. Vero se è riuscito. */
export async function copia(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && window.isSecureContext) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    // Si prova alla vecchia maniera.
  }
  const area = document.createElement("textarea");
  area.value = testo;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
