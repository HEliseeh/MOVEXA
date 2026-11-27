import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';

interface Slide {
  image: string;
  alt: string;
  position: string;
  quote: string;
  author: string;
  label: string;
}

// ---------------------------------------------------------------
// AuthLayout — carte des pages publiques (connexion, mot de passe
// oublié, nouveau mot de passe) : diaporama + citations à gauche,
// formulaire projeté à droite.
// ---------------------------------------------------------------
@Component({
  selector: 'app-auth-layout',
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout implements OnInit {
  private destroyRef = inject(DestroyRef);

  /** Durée d'affichage de chaque image du diaporama (ms) */
  private readonly SLIDE_INTERVAL = 6000;

  readonly slides: Slide[] = [
    {
      image: 'assets/images/login/slide-1.jpg',
      alt: "Un homme s'entraîne aux cordes ondulatoires dans une salle sombre",
      position: '50% 30%',
      quote:
        "Je détestais chaque minute d'entraînement, mais je me disais : n'abandonne pas. Souffre maintenant, et vis le reste de ta vie en champion.",
      author: 'Muhammad Ali · boxeur',
      label: 'Image 1 : cordes ondulatoires',
    },
    {
      image: 'assets/images/login/slide-2.jpg',
      alt: 'Un homme musclé en débardeur noir dans une salle de musculation',
      position: '50% 25%',
      quote:
        "J'accepte l'échec, tout le monde échoue un jour. Mais je n'accepte pas de ne pas essayer.",
      author: 'Michael Jordan · basketteur',
      label: 'Image 2 : musculation',
    },
    {
      image: 'assets/images/login/slide-3.jpg',
      alt: 'Une femme bras tendus pendant un cours collectif',
      position: '72% 35%',
      quote:
        'Un champion ne se définit pas par ses victoires, mais par sa façon de se relever quand il tombe.',
      author: 'Serena Williams · joueuse de tennis',
      label: 'Image 3 : cours collectif',
    },
  ];

  slide = signal(0);
  paused = signal(false);
  /** Images introuvables : masquées pour laisser le fond uni du panneau */
  brokenImages = signal<ReadonlySet<number>>(new Set());

  ngOnInit(): void {
    const timer = setInterval(() => {
      if (!this.paused()) this.slide.update(i => (i + 1) % this.slides.length);
    }, this.SLIDE_INTERVAL);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  goToSlide(index: number): void {
    this.slide.set(index);
  }

  togglePause(): void {
    this.paused.update(v => !v);
  }

  onImageError(index: number): void {
    this.brokenImages.update(set => new Set(set).add(index));
  }
}
