import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { MembersService } from '@core/api/members.service';
import { initials } from '@shared/format';

/**
 * Photo ronde du membre, ou ses initiales s'il n'en a pas.
 * L'image est chargée par l'API (elle demande le jeton de connexion), puis affichée depuis la mémoire.
 * « version » : à changer après un envoi pour recharger l'image.
 */
@Component({
  selector: 'app-member-photo',
  template: `
    @if (url(); as src) {
      <img class="mp" [src]="src" [alt]="'Photo de ' + name()" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span class="mp mp--initials" role="img" [attr.aria-label]="name()" [style.width.px]="size()" [style.height.px]="size()"
            [style.font-size.px]="size() * 0.36">{{ letters() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; flex: none; }
    .mp { border-radius: 50%; object-fit: cover; display: block; }
    .mp--initials {
      display: grid; place-items: center; font-weight: 700;
      background: var(--ds-pastel-mint, #cfe8e3); color: #12262a;
    }
  `,
})
export class MemberPhoto {
  private readonly members = inject(MembersService);

  readonly memberId = input.required<number>();
  readonly hasPhoto = input(false);
  readonly firstName = input<string | null>('');
  readonly lastName = input<string | null>('');
  readonly size = input(56);
  readonly version = input(0);

  readonly url = signal<string | null>(null);
  readonly name = computed(() => `${this.firstName() ?? ''} ${this.lastName() ?? ''}`.trim() || 'Membre');
  readonly letters = computed(() => initials(this.firstName(), this.lastName()) || '?');

  constructor() {
    effect(onCleanup => {
      const id = this.memberId();
      this.version();
      this.release();
      if (!this.hasPhoto()) return;
      const sub = this.members.photo(id).subscribe({
        next: blob => this.url.set(URL.createObjectURL(blob)),
        error: () => this.url.set(null),
      });
      onCleanup(() => sub.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    const u = this.url();
    if (u) URL.revokeObjectURL(u);
    this.url.set(null);
  }
}
