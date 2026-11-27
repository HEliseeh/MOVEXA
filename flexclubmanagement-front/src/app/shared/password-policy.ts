import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// ---------------------------------------------------------------
// Règles d'un nouveau mot de passe — les mêmes que le gateway
// (flexclubmanagement-gateway, security/PasswordPolicy.java).
// ---------------------------------------------------------------
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

export interface PasswordRule {
  key: 'length' | 'uppercase' | 'digit' | 'special';
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    key: 'length',
    label: `Au moins ${PASSWORD_MIN_LENGTH} caractères`,
    test: v => v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH,
  },
  { key: 'uppercase', label: 'Au moins une majuscule', test: v => /\p{Lu}/u.test(v) },
  { key: 'digit', label: 'Au moins un chiffre', test: v => /\p{Nd}/u.test(v) },
  {
    key: 'special',
    label: 'Au moins un caractère spécial (! @ # - …)',
    test: v => /[^\p{L}\p{N}\s]/u.test(v),
  },
];

/** Erreur « passwordPolicy » avec la liste des règles non respectées */
export const passwordPolicyValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = (control.value as string) ?? '';
  if (!value) return null; // « required » s'en charge
  const failed = PASSWORD_RULES.filter(r => !r.test(value)).map(r => r.key);
  return failed.length ? { passwordPolicy: failed } : null;
};
