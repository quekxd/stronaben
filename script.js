// ========================================================
// 1. ZARZĄDZANIE UKŁADEM I DRAG & DROP (PRZECIĄGANIE I OPUSZCZANIE)
// ========================================================

const DEFAULT_LAYOUT = {
    'slot-0': 'panel-slider',
    'slot-1': 'panel-age',
    'slot-2': 'panel-quote',
    'slot-3': 'panel-treat'
};

// Załaduj zapisany układ przed startem
applySavedLayout();

function applySavedLayout() {
    try {
        const saved = JSON.parse(localStorage.getItem('benPanelsLayout'));
        if (saved) {
            Object.keys(saved).forEach(slotId => {
                const slot = document.getElementById(slotId);
                const panel = document.getElementById(saved[slotId]);
                if (slot && panel) {
                    slot.appendChild(panel);
                }
            });
        }
    } catch (e) {
        console.warn('Nie udało się załadować zapisanego układu:', e);
    }
}

function saveCurrentLayout() {
    try {
        const mapping = {};
        for (let i = 0; i < 4; i++) {
            const slotId = `slot-${i}`;
            const slot = document.getElementById(slotId);
            if (slot) {
                const panel = slot.querySelector('.app-panel');
                if (panel) {
                    mapping[slotId] = panel.id;
                }
            }
        }
        localStorage.setItem('benPanelsLayout', JSON.stringify(mapping));
    } catch (e) {
        console.warn('Błąd podczas zapisywania układu:', e);
    }
}

// Resetowanie układu z animacją FLIP dla wszystkich paneli
function resetLayout() {
    const panels = Array.from(document.querySelectorAll('.app-panel'));
    const rectsBefore = new Map();
    panels.forEach(p => rectsBefore.set(p, p.getBoundingClientRect()));

    // Przywróć domyślne sloty
    Object.keys(DEFAULT_LAYOUT).forEach(slotId => {
        const slot = document.getElementById(slotId);
        const panel = document.getElementById(DEFAULT_LAYOUT[slotId]);
        if (slot && panel) {
            slot.appendChild(panel);
        }
    });

    localStorage.removeItem('benPanelsLayout');

    // FLIP dla wszystkich
    panels.forEach(panel => {
        const rectBefore = rectsBefore.get(panel);
        const rectAfter = panel.getBoundingClientRect();
        if (!rectBefore) return;

        const dx = rectBefore.left - rectAfter.left;
        const dy = rectBefore.top - rectAfter.top;
        const sx = rectBefore.width / rectAfter.width;
        const sy = rectBefore.height / rectAfter.height;

        panel.style.transformOrigin = 'top left';
        panel.style.transition = 'none';
        panel.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

        void panel.offsetWidth;

        panel.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
        panel.style.transform = 'translate(0, 0) scale(1, 1)';

        setTimeout(() => {
            panel.style.transform = '';
            panel.style.transition = '';
            panel.style.transformOrigin = '';
        }, 460);
    });

    setTimeout(updateSliderLayout, 470);
}

// Inicjalizacja przeciągania myszką / dotykiem
initDragAndDrop();

function initDragAndDrop() {
    const panels = document.querySelectorAll('.app-panel');

    panels.forEach(panel => {
        panel.addEventListener('pointerdown', handlePointerDown);
    });
}

let dragState = null;

function handlePointerDown(e) {
    // Ignoruj kliknięcia w interaktywne elementy
    const interactive = e.target.closest('button, .prev, .next, .top-controls, .thumbnail, .quote-refresh-btn, .treat-tag, input, a');
    if (interactive) return;

    // Tylko lewy przycisk myszy dla pointerType 'mouse'
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // NA URZĄDZENIACH DOTYKOWYCH (telefony, tablety):
    // Przeciąganie rozpoczyna się WYŁĄCZNIE po dotknięciu ikony uchwytu .drag-handle!
    // Dotknięcie i przesunięcie palcem w dowolnym innym miejscu służy do naturalnego, płynnego przewijania strony (scroll).
    const isTouch = e.pointerType === 'touch';
    const isHandle = e.target.closest('.drag-handle');
    if (isTouch && !isHandle) {
        return;
    }

    const panel = e.currentTarget;
    const slot = panel.closest('.panel-slot');
    if (!slot) return;

    dragState = {
        panel,
        sourceSlot: slot,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        isTouch,
        ghost: null,
        offsetX: 0,
        offsetY: 0
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
}

function handlePointerMove(e) {
    if (!dragState) return;

    // Sprawdź próg przesunięcia (5px dla myszy, 6px dla dotyku)
    if (!dragState.isDragging) {
        const threshold = dragState.isTouch ? 6 : 5;
        const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
        if (dist > threshold) {
            startDragging(e);
        } else {
            return;
        }
    }

    // Blokujemy domyślny scroll tylko podczas aktywnego przeciągania uchwytem
    if (e.cancelable) {
        e.preventDefault();
    }

    // Aktualizuj pozycję ghosta (z lekkim uniesieniem nad palec na telefonach)
    if (dragState.ghost) {
        const left = e.clientX - dragState.offsetX;
        const top = e.clientY - dragState.offsetY - (dragState.isTouch ? 25 : 0);
        dragState.ghost.style.setProperty('left', `${left}px`, 'important');
        dragState.ghost.style.setProperty('top', `${top}px`, 'important');
    }

    // Wykrywaj slot pod kursorem
    updateDropTargetHighlight(e);
}

function startDragging(e) {
    dragState.isDragging = true;
    const panel = dragState.panel;
    const rect = panel.getBoundingClientRect();

    dragState.offsetX = e.clientX - rect.left;
    dragState.offsetY = e.clientY - rect.top;

    // Delikatna wibracja haptyczna na telefonach przy podniesieniu karty
    if (dragState.isTouch && navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
    }

    // Stwórz element-widmo (ghost)
    const ghost = panel.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.id = 'active-drag-ghost';
    // Usuń duplikaty ID wewnątrz ghosta, by nie zaburzać selektorów
    ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    // Wymuszenie kluczowych stylów gwarantujących brak wpływu na flex/grid
    ghost.style.setProperty('position', 'fixed', 'important');
    ghost.style.setProperty('margin', '0', 'important');
    ghost.style.setProperty('width', `${rect.width}px`, 'important');
    ghost.style.setProperty('height', `${rect.height}px`, 'important');
    ghost.style.setProperty('left', `${rect.left}px`, 'important');
    ghost.style.setProperty('top', `${rect.top}px`, 'important');
    ghost.style.setProperty('z-index', '999999', 'important');
    ghost.style.setProperty('pointer-events', 'none', 'important');

    const container = document.getElementById('dragGhostContainer') || document.body;
    container.appendChild(ghost);
    dragState.ghost = ghost;

    // Oznacz oryginalny panel jako placeholder
    panel.classList.add('is-dragged-placeholder');
    document.body.style.cursor = 'grabbing';
}

function updateDropTargetHighlight(e) {
    // Ponieważ ghost ma pointer-events: none !important, hit-testing od razu trafia w element pod spodem
    const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = elemBelow ? elemBelow.closest('.panel-slot') : null;

    document.querySelectorAll('.panel-slot').forEach(slot => {
        if (slot === targetSlot && slot !== dragState.sourceSlot) {
            slot.classList.add('drop-target-active');
        } else {
            slot.classList.remove('drop-target-active');
        }
    });
}

function handlePointerUp(e) {
    if (!dragState) return;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
    document.body.style.cursor = '';

    if (dragState.isDragging) {
        const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
        const targetSlot = elemBelow ? elemBelow.closest('.panel-slot') : null;

        // Czy upuszczono na inny slot?
        if (targetSlot && targetSlot !== dragState.sourceSlot) {
            executeFlipSwap(dragState.panel, targetSlot, dragState.sourceSlot, dragState.ghost);
        } else {
            // Anulowano przeciąganie – powrót na oryginalne miejsce
            cancelDragReturn(dragState.panel, dragState.sourceSlot, dragState.ghost);
        }
    }

    // Wyczyść podświetlenia slotów
    document.querySelectorAll('.panel-slot').forEach(slot => {
        slot.classList.remove('drop-target-active');
    });

    dragState = null;
}

function handlePointerCancel() {
    if (!dragState) return;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
    document.body.style.cursor = '';

    if (dragState.ghost) {
        dragState.ghost.remove();
    }
    if (dragState.panel) {
        dragState.panel.classList.remove('is-dragged-placeholder');
    }
    document.querySelectorAll('.panel-slot').forEach(slot => {
        slot.classList.remove('drop-target-active');
    });
    dragState = null;
}

// Anulowanie – powrót ghosta na oryginalne miejsce
function cancelDragReturn(panel, sourceSlot, ghost) {
    if (!ghost) {
        panel.classList.remove('is-dragged-placeholder');
        return;
    }

    const targetRect = panel.getBoundingClientRect();
    ghost.style.setProperty('transition', 'all 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)', 'important');
    ghost.style.setProperty('left', `${targetRect.left}px`, 'important');
    ghost.style.setProperty('top', `${targetRect.top}px`, 'important');
    ghost.style.setProperty('transform', 'scale(1) rotate(0deg)', 'important');
    ghost.style.setProperty('opacity', '0.5', 'important');

    setTimeout(() => {
        ghost.remove();
        panel.classList.remove('is-dragged-placeholder');
    }, 280);
}

// GŁÓWNA ANIMACJA FLIP: Zamiana dwóch paneli miejscami i adaptacja wielkości
function executeFlipSwap(sourcePanel, targetSlot, sourceSlot, ghost) {
    const targetPanel = targetSlot.querySelector('.app-panel');
    if (!targetPanel) {
        if (ghost) ghost.remove();
        sourcePanel.classList.remove('is-dragged-placeholder');
        return;
    }

    // 1. FIRST: Zapisz pozycje początkowe obu paneli
    // Resetujemy rotację ghosta przed pobraniem pozycji, by wyliczyć czysty prostokąt
    if (ghost) {
        ghost.style.setProperty('transform', 'none', 'important');
    }
    const ghostRect = ghost ? ghost.getBoundingClientRect() : sourcePanel.getBoundingClientRect();
    const sourceRectBefore = ghostRect;
    const targetRectBefore = targetPanel.getBoundingClientRect();

    if (ghost) ghost.remove();
    sourcePanel.classList.remove('is-dragged-placeholder');

    // 2. LAST: Zamień elementy w strukturze DOM
    sourceSlot.appendChild(targetPanel);
    targetSlot.appendChild(sourcePanel);

    saveCurrentLayout();

    // 3. INVERT: Oblicz nowe pozycje i różnice transformacji
    const sourceRectAfter = sourcePanel.getBoundingClientRect();
    const targetRectAfter = targetPanel.getBoundingClientRect();

    const dxSource = sourceRectBefore.left - sourceRectAfter.left;
    const dySource = sourceRectBefore.top - sourceRectAfter.top;
    const sxSource = sourceRectBefore.width / sourceRectAfter.width;
    const sySource = sourceRectBefore.height / sourceRectAfter.height;

    const dxTarget = targetRectBefore.left - targetRectAfter.left;
    const dyTarget = targetRectBefore.top - targetRectAfter.top;
    const sxTarget = targetRectBefore.width / targetRectAfter.width;
    const syTarget = targetRectBefore.height / targetRectAfter.height;

    // Natychmiastowe ustawienie odwróconych pozycji bez animacji
    sourcePanel.style.transformOrigin = 'top left';
    targetPanel.style.transformOrigin = 'top left';
    sourcePanel.style.transition = 'none';
    targetPanel.style.transition = 'none';

    sourcePanel.style.transform = `translate(${dxSource}px, ${dySource}px) scale(${sxSource}, ${sySource})`;
    targetPanel.style.transform = `translate(${dxTarget}px, ${dyTarget}px) scale(${sxTarget}, ${syTarget})`;

    // Wymuś przeliczenie layoutu przez przeglądarkę
    void sourcePanel.offsetWidth;
    void targetPanel.offsetWidth;

    // 4. PLAY: Płynna animacja do docelowych wymiarów i pozycji
    const springAnim = 'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)';
    sourcePanel.style.transition = springAnim;
    targetPanel.style.transition = springAnim;

    sourcePanel.style.transform = 'translate(0px, 0px) scale(1, 1)';
    targetPanel.style.transform = 'translate(0px, 0px) scale(1, 1)';

    setTimeout(() => {
        sourcePanel.style.transform = '';
        sourcePanel.style.transition = '';
        sourcePanel.style.transformOrigin = '';
        targetPanel.style.transform = '';
        targetPanel.style.transition = '';
        targetPanel.style.transformOrigin = '';

        // Dopasuj zdjęcia w sliderze, jeśli brał udział w zamianie
        if (sourcePanel.id === 'panel-slider' || targetPanel.id === 'panel-slider') {
            updateSliderLayout();
        }
    }, 450);
}


// ========================================================
// 2. SKRYPT SLIDERA ZE ZDJĘCIAMI
// ========================================================
let slideIndex = 1;
let isPlaying = true;
let autoSlideTimer;
let progressTimer;
let progressWidth = 0;
const slideDuration = 5000;

generateThumbnails();
showSlides(slideIndex);
startAutoSlide();
initSliderTouchSwipe();

function generateThumbnails() {
    const slides = document.querySelectorAll(".slide img");
    const thumbsContainer = document.getElementById("thumbnailsContainer");
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = "";
    slides.forEach((img, index) => {
        const thumb = document.createElement("img");
        thumb.src = img.src;
        thumb.className = "thumbnail";
        thumb.onclick = (e) => {
            e.stopPropagation();
            currentSlide(index + 1);
        };
        thumbsContainer.appendChild(thumb);
    });
}

function showSlides(n) {
    let slides = document.getElementsByClassName("slide");
    let thumbs = document.getElementsByClassName("thumbnail");
    const track = document.getElementById("slidesTrack");
    if (!track || slides.length === 0) return;

    if (n > slides.length) { slideIndex = 1; }
    if (n < 1) { slideIndex = slides.length; }

    let movePercentage = (slideIndex - 1) * -100;
    track.style.transform = `translateX(${movePercentage}%)`;

    for (let i = 0; i < thumbs.length; i++) {
        thumbs[i].className = thumbs[i].className.replace(" active-thumb", "");
    }

    if (thumbs.length > 0 && thumbs[slideIndex - 1]) {
        thumbs[slideIndex - 1].className += " active-thumb";
        thumbs[slideIndex - 1].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    resetProgressBar();
}

function changeSlide(n) {
    showSlides(slideIndex += n);
    if (isPlaying) resetAutoSlide();
}

function currentSlide(n) {
    showSlides(slideIndex = n);
    if (isPlaying) resetAutoSlide();
}

function startAutoSlide() {
    if (!isPlaying) return;
    autoSlideTimer = setInterval(() => {
        slideIndex++;
        showSlides(slideIndex);
    }, slideDuration);
    startProgressBar();
}

function resetAutoSlide() {
    clearInterval(autoSlideTimer);
    if (isPlaying) startAutoSlide();
}

function startProgressBar() {
    clearInterval(progressTimer);
    progressWidth = 0;
    const progressBar = document.getElementById("progressBar");
    if (!progressBar) return;
    progressTimer = setInterval(() => {
        progressWidth += (50 / slideDuration) * 100;
        progressBar.style.width = progressWidth + "%";
        if (progressWidth >= 100) progressWidth = 0;
    }, 50);
}

function resetProgressBar() {
    clearInterval(progressTimer);
    const progressBar = document.getElementById("progressBar");
    if (progressBar) progressBar.style.width = "0%";
    if (isPlaying) startProgressBar();
}

function togglePlayPause() {
    const btn = document.getElementById("playPauseBtn");
    if (isPlaying) {
        isPlaying = false;
        clearInterval(autoSlideTimer);
        clearInterval(progressTimer);
        btn.innerHTML = "&#9658;";
    } else {
        isPlaying = true;
        btn.innerHTML = "&#10074;&#10074;";
        resetAutoSlide();
    }
}

function toggleFullscreen() {
    const slider = document.getElementById("panel-slider");
    if (!document.fullscreenElement) {
        if (slider.requestFullscreen) {
            slider.requestFullscreen();
        } else if (slider.webkitRequestFullscreen) {
            slider.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function updateSliderLayout() {
    generateThumbnails();
    showSlides(slideIndex);
}

window.addEventListener('resize', () => {
    showSlides(slideIndex);
});

document.addEventListener('fullscreenchange', () => {
    setTimeout(updateSliderLayout, 50);
});

document.addEventListener('webkitfullscreenchange', () => {
    setTimeout(updateSliderLayout, 50);
});

// Obsługa gestów przesuwania (swipe) na telefonach
function initSliderTouchSwipe() {
    const wrapper = document.querySelector(".slides-wrapper");
    if (!wrapper) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isTracking = false;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, .top-controls')) return;
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isTracking = true;
        }
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
        if (!isTracking || e.changedTouches.length !== 1) return;
        isTracking = false;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // Jeśli gest jest wyraźnie poziomy (> 35px i większy niż pionowy)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
            if (deltaX < 0) {
                changeSlide(1); // Swipe w lewo -> następne zdjęcie
            } else {
                changeSlide(-1); // Swipe w prawo -> poprzednie zdjęcie
            }
        }
    }, { passive: true });
}


// ========================================================
// 3. SKRYPT LICZNIKA WIEKU
// ========================================================
function calculateDogAge() {
    const birthDate = new Date('2022-08-15T00:00:00');
    const now = new Date();

    let years = now.getFullYear() - birthDate.getFullYear();
    let months = now.getMonth() - birthDate.getMonth();
    let days = now.getDate() - birthDate.getDate();
    let hours = now.getHours() - birthDate.getHours();
    let minutes = now.getMinutes() - birthDate.getMinutes();
    let seconds = now.getSeconds() - birthDate.getSeconds();

    if (seconds < 0) { seconds += 60; minutes--; }
    if (minutes < 0) { minutes += 60; hours--; }
    if (hours < 0) { hours += 24; days--; }
    if (days < 0) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
        months--;
    }
    if (months < 0) { months += 12; years--; }

    const formatTime = (num) => num < 10 ? '0' + num : num;

    const elYears = document.getElementById('c-years');
    const elMonths = document.getElementById('c-months');
    const elDays = document.getElementById('c-days');
    const elHours = document.getElementById('c-hours');
    const elMinutes = document.getElementById('c-minutes');
    const elSeconds = document.getElementById('c-seconds');

    if (elYears) elYears.innerText = years;
    if (elMonths) elMonths.innerText = months;
    if (elDays) elDays.innerText = days;
    if (elHours) elHours.innerText = formatTime(hours);
    if (elMinutes) elMinutes.innerText = formatTime(minutes);
    if (elSeconds) elSeconds.innerText = formatTime(seconds);
}
calculateDogAge();
setInterval(calculateDogAge, 1000);


// ========================================================
// 4. SKRYPT CYTATU DNIA
// ========================================================
const benQuotes = [
    "Jeśli coś spadło na podłogę, to oficjalnie należy do mnie.",
    "Spacer nie jest opcją, to styl życia.",
    "Patrzę na ciebie nie dlatego, że cię kocham, tylko dlatego, że jesz.",
    "Moim ulubionym sportem jest spanie w poprzek łóżka.",
    "Ogon sam się nie pomerda. No, chyba że powiesz 'Idziemy?'.",
    "Dźwięk otwieranej lodówki to najpiękniejsza symfonia na świecie.",
    "Człowiek myśli, że to on mnie wyprowadza. Słodki, naiwny człowiek.",
    "Każda pora jest dobra na drzemkę. Szczególnie tuż po drzemce.",
    "Nie jestem głodny. Ale zjem, z szacunku do jedzenia.",
    "Koty są dziwne. Kto normalny załatwia się w domu do pudełka?",
    "Zasada trzech sekund nie istnieje. Pół sekundy i zjedzone.",
    "Jeśli nie chcesz, żebym to zjadł, to dlaczego leżało na stole?",
    "Kanapa to moje królestwo. Ty możesz zająć ten mały róg.",
    "Moja praca to szczekanie na kuriera. Robię to z powołania.",
    "Życie jest za krótkie. Zjedz pańskiego buta."
];

function setDailyQuote() {
    const today = new Date();
    const dateNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const quoteIndex = dateNum % benQuotes.length;
    const quoteEl = document.getElementById('benQuote');
    if (quoteEl) quoteEl.innerText = `"${benQuotes[quoteIndex]}"`;
}
setDailyQuote();

function getRandomQuote(event) {
    if (event) event.stopPropagation();
    const quoteEl = document.getElementById('benQuote');
    if (!quoteEl) return;

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * benQuotes.length);
    } while (benQuotes.length > 1 && `"${benQuotes[newIndex]}"` === quoteEl.innerText);

    quoteEl.style.opacity = '0';
    quoteEl.style.transform = 'translateY(6px)';
    setTimeout(() => {
        quoteEl.innerText = `"${benQuotes[newIndex]}"`;
        quoteEl.style.transition = 'all 0.3s ease';
        quoteEl.style.opacity = '1';
        quoteEl.style.transform = 'translateY(0)';
    }, 180);
}


// ========================================================
// 5. GLOBALNY LICZNIK PRZYSMAKÓW (CounterAPI)
// ========================================================
const COUNTER_API_BASE = 'https://api.counterapi.dev/v2/queeeks-team-5525/przysmakibena';

// Wyczyść stary lokalny licznik, który blokował synchronizację z serwerem
localStorage.removeItem('benTreatsCount');

let serverTreatCount = 0;
let pendingLocalIncrements = 0;
let isInitialLoaded = false;

const treatCountEl = document.getElementById('treatCount');
if (treatCountEl) {
    treatCountEl.innerText = '...';
}

// Pobierz aktualny globalny licznik z CounterAPI natychmiast
fetchGlobalTreatCount();

// Odświeżaj licznik co 6 sekund oraz za każdym razem, gdy użytkownik wraca do karty
setInterval(fetchGlobalTreatCount, 6000);
window.addEventListener('focus', fetchGlobalTreatCount);

async function fetchGlobalTreatCount() {
    try {
        const response = await fetch(`${COUNTER_API_BASE}?t=${Date.now()}`);
        if (!response.ok) return;
        const result = await response.json();
        if (result && result.data && typeof result.data.up_count === 'number') {
            serverTreatCount = result.data.up_count;
            isInitialLoaded = true;
            renderTreatCount();
        }
    } catch (err) {
        console.warn('Błąd podczas pobierania globalnego licznika z CounterAPI:', err);
    }
}

function renderTreatCount() {
    if (!treatCountEl) return;
    const total = isInitialLoaded ? (serverTreatCount + pendingLocalIncrements) : 0;
    treatCountEl.innerText = total.toLocaleString('pl-PL');
}

async function incrementGlobalTreat() {
    pendingLocalIncrements++;
    renderTreatCount();

    try {
        const response = await fetch(`${COUNTER_API_BASE}/up?t=${Date.now()}_${Math.random()}`);
        if (response.ok) {
            pendingLocalIncrements = Math.max(0, pendingLocalIncrements - 1);
            serverTreatCount++;
            renderTreatCount();
        } else {
            setTimeout(() => {
                pendingLocalIncrements = Math.max(0, pendingLocalIncrements - 1);
                renderTreatCount();
            }, 1000);
        }
    } catch (err) {
        console.warn('Błąd podczas wysyłania przysmaku do CounterAPI:', err);
        pendingLocalIncrements = Math.max(0, pendingLocalIncrements - 1);
        renderTreatCount();
    }
}

function giveTreat(event) {
    if (event) event.stopPropagation();
    incrementGlobalTreat();

    const treats = ['🦴', '🥩', '🥓', '🍗'];
    spawnFloatingTreats(event, treats, 6);
}

function giveSpecialTreat(event, emoji) {
    if (event) event.stopPropagation();
    incrementGlobalTreat();

    spawnFloatingTreats(event, [emoji], 7);
}

function spawnFloatingTreats(event, treatEmojis, count) {
    const section = document.getElementById('treatSection') || event.currentTarget;
    const rect = section.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
        const treat = document.createElement('div');
        treat.className = 'floating-treat';
        treat.innerText = treatEmojis[Math.floor(Math.random() * treatEmojis.length)];

        const clickX = event.clientX ? (event.clientX - rect.left) : (rect.width / 2);
        const clickY = event.clientY ? (event.clientY - rect.top) : (rect.height / 2);

        treat.style.left = `${clickX}px`;
        treat.style.top = `${clickY}px`;

        const offsetX = (Math.random() - 0.5) * 260;
        const rotation = (Math.random() - 0.5) * 360;

        treat.style.setProperty('--offset-x', `${offsetX}px`);
        treat.style.setProperty('--rotation', `${rotation}deg`);

        section.appendChild(treat);
        setTimeout(() => { treat.remove(); }, 1200);
    }
}
