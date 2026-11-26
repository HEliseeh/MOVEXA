package com.mycompany.myapp.service;

import com.mycompany.myapp.domain.Activity;
import com.mycompany.myapp.domain.Coach;
import com.mycompany.myapp.domain.Course;
import com.mycompany.myapp.domain.CourseSlot;
import com.mycompany.myapp.repository.ActivityRepository;
import com.mycompany.myapp.repository.CheckInRepository;
import com.mycompany.myapp.repository.CourseRepository;
import com.mycompany.myapp.repository.CourseSlotRepository;
import com.mycompany.myapp.service.dto.CourseDtos.CourseDTO;
import com.mycompany.myapp.service.dto.CourseDtos.SessionDTO;
import com.mycompany.myapp.service.dto.CourseDtos.SlotDTO;
import com.mycompany.myapp.service.dto.CourseDtos.WeekDTO;
import com.mycompany.myapp.service.util.Dates;
import com.mycompany.myapp.web.rest.errors.NotFoundException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Cours collectifs et planning du club (sans réservation dans le MVP).
 * Les présents d'une séance = membres pointés sur l'activité du cours entre 30 minutes avant le début et la fin.
 */
@Service
@Transactional
public class CourseService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    /** Un membre qui pointe jusqu'à 30 minutes avant le cours compte comme présent */
    private static final Duration EARLY = Duration.ofMinutes(30);
    private static final Set<String> COLORS = Set.of("mint", "peach", "lavender", "lime", "sky", "rose");

    private final CourseRepository courseRepository;
    private final CourseSlotRepository slotRepository;
    private final ActivityRepository activityRepository;
    private final CheckInRepository checkInRepository;
    private final CoachService coachService;

    public CourseService(
        CourseRepository courseRepository,
        CourseSlotRepository slotRepository,
        ActivityRepository activityRepository,
        CheckInRepository checkInRepository,
        CoachService coachService
    ) {
        this.courseRepository = courseRepository;
        this.slotRepository = slotRepository;
        this.activityRepository = activityRepository;
        this.checkInRepository = checkInRepository;
        this.coachService = coachService;
    }

    // ---- Cours ----

    @Transactional(readOnly = true)
    public List<CourseDTO> list() {
        List<CourseSlot> slots = slotRepository.findAllWithCourse();
        Map<Long, List<CourseSlot>> byCourse = slots.stream().collect(Collectors.groupingBy(s -> s.getCourse().getId()));
        // Remplissage moyen : séances passées des 4 dernières semaines
        LocalDate today = Dates.today();
        Map<Long, List<SessionDTO>> past = sessions(slots, today.minusDays(28), today.plusDays(1))
            .stream()
            .filter(s -> s.present() != null)
            .collect(Collectors.groupingBy(SessionDTO::courseId));
        return courseRepository
            .findAllByOrderByActiveDescNameAsc()
            .stream()
            .map(c -> toDto(c, byCourse.getOrDefault(c.getId(), List.of()), fill(past.get(c.getId()))))
            .toList();
    }

    public CourseDTO create(CourseDTO dto) {
        Course c = new Course();
        apply(c, dto);
        return toDto(courseRepository.save(c), List.of(), null);
    }

    public Optional<CourseDTO> update(Long id, CourseDTO dto) {
        return courseRepository
            .findById(id)
            .map(c -> {
                apply(c, dto);
                List<CourseSlot> slots = slotRepository.findAllWithCourse().stream().filter(s -> s.getCourse().getId().equals(id)).toList();
                return toDto(c, slots, null);
            });
    }

    // ---- Créneaux ----

    public SlotDTO addSlot(Long courseId, SlotDTO dto) {
        Course course = courseRepository.findById(courseId).orElseThrow(() -> new NotFoundException("Cours introuvable"));
        CourseSlot s = new CourseSlot();
        s.setCourse(course);
        applySlot(s, dto);
        return toDto(slotRepository.save(s));
    }

    public Optional<SlotDTO> updateSlot(Long id, SlotDTO dto) {
        return slotRepository
            .findById(id)
            .map(s -> {
                applySlot(s, dto);
                return toDto(s);
            });
    }

    public void deleteSlot(Long id) {
        CourseSlot s = slotRepository.findById(id).orElseThrow(() -> new NotFoundException("Créneau introuvable"));
        slotRepository.delete(s);
    }

    // ---- Planning ----

    /** Semaine (du lundi au dimanche) contenant le jour donné : séances des cours en vente */
    @Transactional(readOnly = true)
    public WeekDTO week(LocalDate anyDay) {
        LocalDate monday = (anyDay != null ? anyDay : Dates.today()).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<CourseSlot> slots = slotRepository.findAllWithCourse().stream().filter(s -> s.getCourse().isActive()).toList();
        return new WeekDTO(monday, sessions(slots, monday, monday.plusDays(7)));
    }

    // ---------------------------------------------------------------------------------------------

    /** Séances des créneaux entre from (inclus) et to (exclu), avec les présents pour celles déjà commencées */
    private List<SessionDTO> sessions(List<CourseSlot> slots, LocalDate from, LocalDate to) {
        Instant now = Instant.now();
        // Pointages sur une activité pendant la période, regroupés par activité
        Map<Long, List<Object[]>> entries = checkInRepository
            .findActivityEntriesBetween(Dates.startOf(from).minus(EARLY), Dates.startOf(to))
            .stream()
            .collect(Collectors.groupingBy(r -> (Long) r[0]));
        List<SessionDTO> result = new ArrayList<>();
        for (LocalDate day = from; day.isBefore(to); day = day.plusDays(1)) {
            int dow = day.getDayOfWeek().getValue();
            for (CourseSlot s : slots) {
                if (s.getDayOfWeek() != dow) continue;
                Course c = s.getCourse();
                Instant start = day.atTime(s.getStartTime()).atZone(Dates.ZONE).toInstant();
                Instant end = start.plus(Duration.ofMinutes(c.getDurationMinutes()));
                Integer present = null;
                if (c.getActivity() != null && !start.isAfter(now)) {
                    Instant earliest = start.minus(EARLY);
                    present = (int) entries
                        .getOrDefault(c.getActivity().getId(), List.of())
                        .stream()
                        .filter(r -> {
                            Instant at = (Instant) r[2];
                            return !at.isBefore(earliest) && at.isBefore(end);
                        })
                        .map(r -> r[1])
                        .distinct()
                        .count();
                }
                LocalTime endTime = s.getStartTime().plusMinutes(c.getDurationMinutes());
                result.add(
                    new SessionDTO(
                        s.getId(),
                        c.getId(),
                        c.getName(),
                        day,
                        s.getStartTime().format(HH_MM),
                        endTime.format(HH_MM),
                        coachName(s.getCoach() != null ? s.getCoach() : c.getCoach()),
                        StringUtils.hasText(s.getRoom()) ? s.getRoom() : c.getRoom(),
                        c.getCapacity(),
                        c.getColor(),
                        present
                    )
                );
            }
        }
        result.sort(Comparator.comparing(SessionDTO::date).thenComparing(SessionDTO::startTime));
        return result;
    }

    /** Remplissage moyen (en %) des séances mesurées, null s'il n'y en a pas */
    private static Integer fill(List<SessionDTO> sessions) {
        if (sessions == null || sessions.isEmpty()) return null;
        double avg = sessions
            .stream()
            .mapToDouble(s -> Math.min(1.0, (double) s.present() / Math.max(1, s.capacity())))
            .average()
            .orElse(0);
        return (int) Math.round(avg * 100);
    }

    private void apply(Course c, CourseDTO dto) {
        c.setName(dto.name().trim());
        c.setDescription(clean(dto.description()));
        c.setCoach(dto.coachId() == null ? null : coachService.require(dto.coachId()));
        c.setActivity(
            dto.activityId() == null
                ? null
                : activityRepository.findById(dto.activityId()).orElseThrow(() -> new NotFoundException("Activité introuvable"))
        );
        c.setDurationMinutes(dto.durationMinutes());
        c.setCapacity(dto.capacity());
        c.setRoom(clean(dto.room()));
        c.setColor(dto.color() != null && COLORS.contains(dto.color()) ? dto.color() : "mint");
        c.setActive(dto.active() == null || dto.active());
    }

    private void applySlot(CourseSlot s, SlotDTO dto) {
        s.setDayOfWeek(dto.dayOfWeek());
        s.setStartTime(LocalTime.parse(dto.startTime(), HH_MM));
        s.setRoom(clean(dto.room()));
        s.setCoach(dto.coachId() == null ? null : coachService.require(dto.coachId()));
    }

    private CourseDTO toDto(Course c, List<CourseSlot> slots, Integer avgFill) {
        Activity a = c.getActivity();
        return new CourseDTO(
            c.getId(),
            c.getName(),
            c.getDescription(),
            c.getCoach() != null ? c.getCoach().getId() : null,
            coachName(c.getCoach()),
            a != null ? a.getId() : null,
            a != null ? a.getName() : null,
            c.getDurationMinutes(),
            c.getCapacity(),
            c.getRoom(),
            c.getColor(),
            c.isActive(),
            slots
                .stream()
                .sorted(Comparator.comparingInt(CourseSlot::getDayOfWeek).thenComparing(CourseSlot::getStartTime))
                .map(this::toDto)
                .toList(),
            avgFill
        );
    }

    private SlotDTO toDto(CourseSlot s) {
        return new SlotDTO(
            s.getId(),
            s.getCourse().getId(),
            s.getDayOfWeek(),
            s.getStartTime().format(HH_MM),
            s.getRoom(),
            s.getCoach() != null ? s.getCoach().getId() : null,
            coachName(s.getCoach())
        );
    }

    private static String coachName(Coach coach) {
        return coach == null ? null : coach.getFullName();
    }

    private static String clean(String value) {
        return StringUtils.hasText(value) ? value.trim().replaceAll("\\s+", " ") : null;
    }
}
