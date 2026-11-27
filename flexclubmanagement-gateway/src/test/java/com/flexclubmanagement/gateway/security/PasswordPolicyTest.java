package com.flexclubmanagement.gateway.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    @Test
    void acceptsEightCharactersWithUppercaseDigitAndSpecial() {
        assertThat(PasswordPolicy.isValid("Passw0rd!")).isTrue();
        assertThat(PasswordPolicy.isValid("Élisée-24")).isTrue();
        assertThat(PasswordPolicy.isValid("Abcdef1@")).isTrue();
    }

    @Test
    void rejectsTooShort() {
        assertThat(PasswordPolicy.isValid("Ab!cdef")).isFalse();
    }

    @Test
    void rejectsWithoutUppercase() {
        assertThat(PasswordPolicy.isValid("passw0rd!")).isFalse();
    }

    @Test
    void rejectsWithoutDigit() {
        assertThat(PasswordPolicy.isValid("Password!")).isFalse();
    }

    @Test
    void rejectsWithoutSpecialCharacter() {
        assertThat(PasswordPolicy.isValid("Passw0rd")).isFalse();
        assertThat(PasswordPolicy.isValid("Pass w0rd")).isFalse();
    }

    @Test
    void rejectsNullAndTooLong() {
        assertThat(PasswordPolicy.isValid(null)).isFalse();
        assertThat(PasswordPolicy.isValid("A1!" + "a".repeat(98))).isFalse();
    }
}
