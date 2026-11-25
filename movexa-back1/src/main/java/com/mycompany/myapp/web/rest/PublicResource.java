package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.service.PublicService;
import com.mycompany.myapp.service.dto.PublicDtos.PublicCardDTO;
import com.mycompany.myapp.service.dto.PublicDtos.PublicReceiptDTO;
import org.springframework.web.bind.annotation.*;

/**
 * Pages envoyées au membre par WhatsApp, sans compte ni connexion :
 * sa carte (QR code d'accès) et ses reçus. Le lien contient un jeton aléatoire impossible à deviner.
 */
@RestController
@RequestMapping("/api/public")
public class PublicResource {

    private final PublicService publicService;

    public PublicResource(PublicService publicService) {
        this.publicService = publicService;
    }

    @GetMapping("/cards/{token}")
    public PublicCardDTO card(@PathVariable String token) {
        return publicService.card(token);
    }

    @GetMapping("/receipts/{token}")
    public PublicReceiptDTO receipt(@PathVariable String token) {
        return publicService.receipt(token);
    }
}
