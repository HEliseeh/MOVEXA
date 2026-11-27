import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PublicReceipt } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { dayHour, fcfa, frDate, METHOD_LABELS } from '@shared/format';

/** Reçu ouvert par le membre depuis le lien WhatsApp (maquette « Reçu envoyé au membre »). */
@Component({
  selector: 'app-public-receipt',
  imports: [RouterLink],
  templateUrl: './public-receipt.html',
  styleUrl: '../member-card/public-page.css',
})
export class PublicReceiptPage implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Paramètre de route :token */
  readonly token = input<string>();

  readonly receipt = signal<PublicReceipt | null>(null);
  readonly error = signal<string | null>(null);
  readonly fcfa = fcfa;
  readonly frDate = frDate;
  readonly dayHour = dayHour;
  readonly methodLabels = METHOD_LABELS;

  ngOnInit(): void {
    this.api
      .publicReceipt(this.token() ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.receipt.set(r);
          document.title = `Reçu ${r.number ?? ''} · ${r.gymName ?? 'FLEXCLUBMANAGEMENT'}`;
        },
        error: () => this.error.set('Ce reçu est introuvable. Demandez-le à l’accueil de votre salle.'),
      });
  }

  /** Impression ou « Enregistrer en PDF » depuis le téléphone */
  print(): void {
    window.print();
  }
}
