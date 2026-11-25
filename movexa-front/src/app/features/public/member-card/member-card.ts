import { Component, DestroyRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PublicCard } from '@core/api/api.models';
import { MovexaApi } from '@core/api/movexa-api.service';
import { frDate } from '@shared/format';
import { QrCode } from '@shared/qr-code/qr-code';

/**
 * Carte du membre (maquette « QR code envoyé au membre »), ouverte depuis le lien WhatsApp.
 * Page publique : pas de compte à créer, le jeton du lien est celui du QR code.
 */
@Component({
  selector: 'app-member-card',
  imports: [QrCode],
  templateUrl: './member-card.html',
  styleUrl: './public-page.css',
})
export class MemberCard implements OnInit {
  private readonly api = inject(MovexaApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly qr = viewChild(QrCode);

  /** Paramètre de route :token */
  readonly token = input<string>();

  readonly card = signal<PublicCard | null>(null);
  readonly error = signal<string | null>(null);
  readonly frDate = frDate;

  ngOnInit(): void {
    this.api
      .publicCard(this.token() ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => {
          this.card.set(c);
          document.title = `Ma carte · ${c.gymName ?? 'MOVEXA'}`;
        },
        error: () => this.error.set('Ce lien n’est plus valable. Demandez votre QR code à l’accueil.'),
      });
  }

  /** « Valable jusqu'au … » : vert si actif, orange si bientôt fini, rouge si expiré */
  tone(c: PublicCard): 'ok' | 'warn' | 'ko' {
    return c.state === 'ACTIVE' ? 'ok' : c.state === 'EXPIRING_SOON' ? 'warn' : 'ko';
  }

  status(c: PublicCard): string {
    if (!c.endDate) return 'Pas d’abonnement en cours';
    return c.state === 'EXPIRED' ? `Expiré depuis le ${frDate(c.endDate)}` : `Valable jusqu’au ${frDate(c.endDate)}`;
  }

  save(c: PublicCard): void {
    const png = this.qr()?.toPng();
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `qr-${c.memberNumber ?? 'membre'}.png`;
    a.click();
  }
}
