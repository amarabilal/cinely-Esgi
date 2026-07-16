<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, X, ExternalLink } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'vue-sonner';

const router = useRouter();
const loading = ref(true);
const googleConnected = ref(false);
const events = ref<any[]>([]);

const currentDate = new Date();
const currentYear = ref(currentDate.getFullYear());
const currentMonth = ref(currentDate.getMonth());

const selectedEvent = ref<any | null>(null);

const monthName = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value, 1);
  const raw = date.toLocaleString('fr-FR', { month: 'long' });
  return raw.charAt(0).toUpperCase() + raw.slice(1) + ' ' + currentYear.value;
});

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const calendarDays = computed(() => {
  const firstDayOfMonth = new Date(currentYear.value, currentMonth.value, 1);
  const lastDayOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0);

  let startDayOfWeek = firstDayOfMonth.getDay();

  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; key: string }[] = [];

  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayDate = new Date(currentYear.value, currentMonth.value - 1, prevMonthLastDay - i);
    days.push({
      date: dayDate,
      isCurrentMonth: false,
      isToday: isSameDay(dayDate, new Date()),
      key: `prev-${prevMonthLastDay - i}`,
    });
  }

  for (let i = 1; i <= totalDaysInMonth; i++) {
    const dayDate = new Date(currentYear.value, currentMonth.value, i);
    days.push({
      date: dayDate,
      isCurrentMonth: true,
      isToday: isSameDay(dayDate, new Date()),
      key: `curr-${i}`,
    });
  }

  const nextMonthPadding = 42 - days.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    const dayDate = new Date(currentYear.value, currentMonth.value + 1, i);
    days.push({
      date: dayDate,
      isCurrentMonth: false,
      isToday: isSameDay(dayDate, new Date()),
      key: `next-${i}`,
    });
  }

  return days;
});

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

async function checkConnection() {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const res = await fetch('/api/google/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      googleConnected.value = data.connected;
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchEvents() {
  if (!googleConnected.value) {
    loading.value = false;
    return;
  }
  loading.value = true;

  const firstGridDate = calendarDays.value[0].date;
  const lastGridDate = calendarDays.value[calendarDays.value.length - 1].date;

  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(
      `/api/google/calendar-events?timeMin=${firstGridDate.toISOString()}&timeMax=${lastGridDate.toISOString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      events.value = await res.json();
    } else {
      toast.error('Impossible de charger vos événements Google Calendar');
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

const eventsByDay = computed(() => {
  const map: Record<string, any[]> = {};

  events.value.forEach(event => {

    const dateStr = event.start.dateTime || event.start.date;
    if (!dateStr) return;

    const dayKey = dateStr.split('T')[0];
    if (!map[dayKey]) map[dayKey] = [];
    map[dayKey].push(event);
  });

  return map;
});

function getDayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  await fetchEvents();
}

async function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  await fetchEvents();
}

onMounted(async () => {
  await checkConnection();
  await fetchEvents();
});

function formatEventTime(event: any) {
  if (event.start.date) return 'Toute la journée';
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function selectEvent(event: any) {
  selectedEvent.value = event;
}
</script>

<template>
  <div class="h-full flex flex-col min-h-0 flex-1 bg-background text-foreground overflow-hidden">

    <header class="shrink-0 border-b border-border bg-background px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <CalendarIcon class="size-5 text-primary" />
        <h1 class="text-xl font-semibold tracking-tight">Mon Calendrier</h1>
      </div>

      <div v-if="googleConnected" class="flex items-center gap-2">
        <div class="size-2 rounded-full bg-green-500 animate-pulse"></div>
        <span class="text-xs font-medium text-muted-foreground">Google Calendar synchronisé</span>
      </div>
    </header>

    <div class="flex-1 min-h-0 overflow-y-auto p-6">

      <div v-if="!googleConnected" class="max-w-md mx-auto my-12 bg-card border border-border rounded-xl p-6 text-center space-y-4 shadow-sm">
        <div class="flex justify-center">
          <div class="p-3 bg-primary/10 rounded-full text-primary">
            <CalendarIcon class="size-8" />
          </div>
        </div>
        <h2 class="text-lg font-semibold text-foreground">Synchronisez votre Google Calendar</h2>
        <p class="text-sm text-muted-foreground">
          Visualisez, gérez et suivez vos rendez-vous directement depuis Cinely. Connectez votre compte Google dans les paramètres de profil pour activer le calendrier.
        </p>
        <div class="pt-2">
          <Button @click="router.push('/settings')">
            Connecter Google dans les Paramètres
          </Button>
        </div>
      </div>

      <div v-else class="h-full flex flex-col space-y-4">

        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground tracking-tight">{{ monthName }}</h2>
          <div class="flex items-center gap-1">
            <Button variant="outline" size="icon" @click="prevMonth">
              <ChevronLeft class="size-4" />
            </Button>
            <Button variant="outline" size="icon" @click="nextMonth">
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>

        <div class="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col min-h-[500px]">

          <div class="grid grid-cols-7 border-b border-border bg-muted/40">
            <div
              v-for="day in weekdays" :key="day"
              class="py-2 text-center text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {{ day }}
            </div>
          </div>

          <div class="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
            <div
              v-for="cell in calendarDays" :key="cell.key"
              class="p-1 border-r border-b border-border last:border-r-0 min-h-0 flex flex-col"
              :class="[
                cell.isCurrentMonth ? '' : 'bg-muted/10 opacity-50',
                cell.isToday ? 'bg-primary/5' : ''
              ]"
            >

              <div class="flex justify-between items-center p-1">
                <span
                  class="text-xs font-medium text-muted-foreground flex size-5 items-center justify-center rounded-full"
                  :class="cell.isToday ? 'bg-primary text-white font-bold' : ''"
                >
                  {{ cell.date.getDate() }}
                </span>
              </div>

              <div class="flex-1 overflow-y-auto space-y-1 p-0.5 scrollbar-none min-h-0">

                <template v-if="loading">
                  <div class="h-4 bg-muted animate-pulse rounded" />
                </template>

                <template v-else>
                  <button
                    v-for="event in eventsByDay[getDayKey(cell.date)]" :key="event.id"
                    type="button"
                    class="w-full text-left truncate text-[10px] px-1.5 py-0.5 rounded transition-all font-medium border active:scale-95"
                    :class="[
                      event.start.date ? 'bg-primary/10 border-primary/20 text-primary-foreground' : 'bg-accent border-border text-foreground'
                    ]"
                    :title="event.summary"
                    @click="selectEvent(event)"
                  >
                    {{ event.summary || 'Sans titre' }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="selectedEvent"
          class="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 p-4 pt-[18vh] backdrop-blur-sm"
          @click.self="selectedEvent = null"
        >
          <div
            class="modal-panel w-full max-w-md rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
            role="dialog"
            aria-modal="true"
          >

            <div class="flex items-center justify-between border-b border-border px-4 py-3">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <CalendarIcon class="size-4 text-primary" />
                Détails de l'événement
              </div>
              <button class="text-muted-foreground transition-colors hover:text-foreground" @click="selectedEvent = null">
                <X class="size-4" />
              </button>
            </div>

            <div class="p-5 space-y-4">
              <div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">
                  {{ selectedEvent.summary || 'Sans titre' }}
                </h3>
              </div>

              <div class="flex items-start gap-2.5 text-sm">
                <Clock class="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p class="font-medium text-foreground">
                    {{ selectedEvent.start.date ? 'Toute la journée' : formatEventTime(selectedEvent) }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ new Date(selectedEvent.start.dateTime || selectedEvent.start.date).toLocaleDateString('fr-FR', { dateStyle: 'full' }) }}
                  </p>
                </div>
              </div>

              <div v-if="selectedEvent.location" class="flex items-start gap-2.5 text-sm">
                <MapPin class="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <p class="text-foreground font-medium">{{ selectedEvent.location }}</p>
              </div>

              <div v-if="selectedEvent.description" class="bg-muted/40 border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p class="font-medium text-foreground">Description :</p>
                <p class="whitespace-pre-wrap leading-relaxed">{{ selectedEvent.description }}</p>
              </div>

              <div class="flex items-center gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" class="ml-auto" @click="selectedEvent = null">
                  Fermer
                </Button>
                <a :href="selectedEvent.htmlLink" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" class="gap-1.5">
                    <ExternalLink class="size-3.5" />
                    Voir sur Google Calendar
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(-10px) scale(0.97);
  opacity: 0;
}
</style>
