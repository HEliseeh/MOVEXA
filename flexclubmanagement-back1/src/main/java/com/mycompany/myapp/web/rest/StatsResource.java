package com.mycompany.myapp.web.rest;

import com.mycompany.myapp.security.AuthoritiesConstants;
import com.mycompany.myapp.service.StatsService;
import com.mycompany.myapp.service.dto.StatsDtos.ManagementStatsDTO;
import com.mycompany.myapp.service.dto.StatsDtos.SalesStatsDTO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Page Statistiques : la partie gestion (argent) est réservée au gérant, la partie commerciale au gérant et aux commerciaux. */
@RestController
@RequestMapping("/api/stats")
public class StatsResource {

    private final StatsService statsService;

    public StatsResource(StatsService statsService) {
        this.statsService = statsService;
    }

    /** GET /api/stats/management?period=MONTH|QUARTER|YEAR */
    @GetMapping("/management")
    @PreAuthorize(AuthoritiesConstants.IS_MANAGER)
    public ManagementStatsDTO management(@RequestParam(defaultValue = "MONTH") String period) {
        return statsService.management(period);
    }

    /** GET /api/stats/sales?period=MONTH|QUARTER|YEAR */
    @GetMapping("/sales")
    @PreAuthorize(AuthoritiesConstants.IS_SALES)
    public SalesStatsDTO sales(@RequestParam(defaultValue = "MONTH") String period) {
        return statsService.sales(period);
    }
}
