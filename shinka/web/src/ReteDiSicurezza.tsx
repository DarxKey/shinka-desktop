/**
 * La rete di sicurezza di una pagina: se la pagina si rompe mentre si disegna, al suo posto compare
 * un avviso con il motivo, e la barra laterale resta, così si può andare altrove. Succede per
 * esempio a un'interfaccia più vecchia del centro, come quella dentro Shinka Desktop, davanti a dati
 * che non conosce. Cambiando pagina si riprova.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

export class ReteDiSicurezza extends Component<{ children: ReactNode; menu?: ReactNode }, { errore?: string }> {
  override state: { errore?: string } = {};

  static getDerivedStateFromError(errore: unknown): { errore: string } {
    return { errore: errore instanceof Error ? errore.message : String(errore) };
  }

  override componentDidCatch(errore: unknown, info: ErrorInfo): void {
    console.error("Una pagina di Shinka si è rotta:", errore, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.errore === undefined) return this.props.children;
    return (
      <div className="pagina pagina-rotta">
        {this.props.menu}
        <div className="avviso-pagina-rotta" role="alert">
          <h2>Questa pagina non si è potuta mostrare</h2>
          <p>Le altre funzionano: scegline una dalla barra laterale. Se usi Shinka Desktop, può darsi che la sua interfaccia sia più vecchia del centro: aggiornala.</p>
          <p className="tenue">
            <code>{this.state.errore}</code>
          </p>
          <button type="button" className="mini" onClick={() => this.setState({ errore: undefined })}>
            Riprova
          </button>
        </div>
      </div>
    );
  }
}
