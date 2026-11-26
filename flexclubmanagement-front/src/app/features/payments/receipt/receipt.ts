import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Receipt } from '@core/api/api.models';
import { FlexclubmanagementApi } from '@core/api/flexclubmanagement-api.service';
import { dayHour, fcfa, frDate, METHOD_LABELS, whatsappLink } from '@shared/format';

/**
 * Reçu de paiement (maquette « Reçu envoyé au membre ») : imprimable, et partageable par WhatsApp.
 * Le message WhatsApp contient le lien public du reçu, que le membre ouvre sans compte.
 */
@Component({
  selector: 'app-receipt',
  imports: [RouterLink],
  templateUrl: './receipt.html',
  styleUrl: './receipt.css',
})
export class ReceiptPage implements OnInit {
  private readonly api = inject(FlexclubmanagementApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Paramètre de route :id */
  readonly id = input<string>();

  readonly receipt = signal<Receipt | null>(null);
  /** Lien public du reçu (ouvrable par le membre sans compte) */
  readonly shareUrl = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly fcfa = fcfa;
  readonly frDate = frDate;
  readonly dayHour = dayHour;
  readonly methodLabels = METHOD_LABELS;

  ngOnInit(): void {
    this.api
      .receipt(Number(this.id()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.receipt.set(r);
          if (r.status === 'PAID') this.loadShareLink(r.paymentId);
        },
        error: () => this.error.set('Reçu introuvable.'),
      });
  }

  private loadShareLink(id: number): void {
    this.api
      .shareReceipt(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => this.shareUrl.set(`${window.location.origin}/recu/${t.token}`), error: () => {} });
  }

  print(): void {
    window.print();
  }

  whatsapp(r: Receipt): string {
    const link = this.shareUrl();
    const text =
      `Reçu ${r.number} · ${r.gymName ?? ''}\n` +
      `${r.memberName} (N° ${r.memberNumber})\n` +
      `${r.planName} : ${fcfa(r.amount)} payé (${METHOD_LABELS[r.method]}) le ${dayHour(r.paidAt)}\n` +
      `Valable du ${frDate(r.validFrom)} au ${frDate(r.validTo)}.\n` +
      (link ? `Votre reçu et votre QR code : ${link}\n` : '') +
      `${r.footer ?? 'Merci !'}`;
    return whatsappLink(r.memberPhone, text);
  }
}
