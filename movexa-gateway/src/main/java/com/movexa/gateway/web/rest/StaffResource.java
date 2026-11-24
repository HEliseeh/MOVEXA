package com.movexa.gateway.web.rest;

import com.movexa.gateway.security.AuthoritiesConstants;
import com.movexa.gateway.service.StaffService;
import com.movexa.gateway.service.dto.StaffDTOs.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/** Comptes du personnel (Paramètres › Utilisateurs). Réservé au gérant. */
@RestController
@RequestMapping("/api/admin/staff")
@PreAuthorize("hasAuthority(\"" + AuthoritiesConstants.ADMIN + "\")")
public class StaffResource {

    private final StaffService staffService;

    public StaffResource(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping("")
    public Mono<List<StaffAccount>> list() {
        return staffService.list();
    }

    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<StaffAccount> create(@Valid @RequestBody CreateStaffRequest request) {
        return staffService.create(request);
    }

    @PutMapping("/{id}")
    public Mono<StaffAccount> update(@PathVariable Long id, @Valid @RequestBody UpdateStaffRequest request) {
        return staffService.update(id, request);
    }

    /** Le gérant remet un mot de passe (oubli, départ…) et le transmet lui-même à la personne. */
    @PutMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        return staffService.resetPassword(id, request);
    }
}
