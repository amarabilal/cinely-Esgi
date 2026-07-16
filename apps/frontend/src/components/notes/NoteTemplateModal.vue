<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  FileText, ListChecks, Users, BookOpen, Bug, Calendar, X,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useNotesStore } from '@/stores/notes.store';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const router = useRouter();
const store = useNotesStore();
const creating = ref(false);

interface NoteTemplate {
  name: string;
  description: string;
  icon: any;
  title: string;
  content: string;
}

const templates: NoteTemplate[] = [
  {
    name: 'Blank',
    description: 'Start from scratch',
    icon: FileText,
    title: '',
    content: '',
  },
  {
    name: 'Meeting Notes',
    description: 'Structured meeting agenda & action items',
    icon: Users,
    title: 'Meeting Notes',
    content: `<h2>📋 Meeting Details</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Attendees:</strong> </p>
<p><strong>Objective:</strong> </p>
<h2>📝 Agenda</h2>
<ol><li><p>Topic 1</p></li><li><p>Topic 2</p></li><li><p>Topic 3</p></li></ol>
<h2>💬 Discussion Notes</h2>
<p></p>
<h2>✅ Action Items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Action item 1 — <em>Owner</em></p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Action item 2 — <em>Owner</em></p></div></li></ul>
<h2>📅 Next Steps</h2>
<p></p>`,
  },
  {
    name: 'To-Do List',
    description: 'Task checklist with priorities',
    icon: ListChecks,
    title: 'To-Do List',
    content: `<h2>🎯 Today's Priorities</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>High priority task</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Important task</p></div></li></ul>
<h2>📋 Backlog</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Task for later</p></div></li></ul>
<h2>📝 Notes</h2>
<p></p>`,
  },
  {
    name: 'Daily Journal',
    description: 'Reflect on your day',
    icon: Calendar,
    title: `Journal — ${new Date().toLocaleDateString()}`,
    content: `<h2>🌅 Morning Intentions</h2>
<p>What do I want to accomplish today?</p>
<p></p>
<h2>🔑 Key Highlights</h2>
<ul><li><p></p></li></ul>
<h2>💡 Learnings & Insights</h2>
<p></p>
<h2>🙏 Gratitude</h2>
<p>Three things I'm grateful for today:</p>
<ol><li><p></p></li><li><p></p></li><li><p></p></li></ol>
<h2>🌙 Evening Reflection</h2>
<p>How did the day go? What would I do differently?</p>
<p></p>`,
  },
  {
    name: 'Project Plan',
    description: 'Outline goals, milestones & deliverables',
    icon: BookOpen,
    title: 'Project Plan',
    content: `<h2>🎯 Project Overview</h2>
<p><strong>Project Name:</strong> </p>
<p><strong>Goal:</strong> </p>
<p><strong>Deadline:</strong> </p>
<h2>📊 Milestones</h2>
<table><tr><th>Milestone</th><th>Due Date</th><th>Status</th></tr><tr><td>Phase 1</td><td></td><td>🟡 In Progress</td></tr><tr><td>Phase 2</td><td></td><td>⚪ Not Started</td></tr><tr><td>Launch</td><td></td><td>⚪ Not Started</td></tr></table>
<h2>📋 Tasks</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Define requirements</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Design solution</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Implement</p></div></li></ul>
<h2>⚠️ Risks & Dependencies</h2>
<p></p>`,
  },
  {
    name: 'Bug Report',
    description: 'Document and track issues',
    icon: Bug,
    title: 'Bug Report',
    content: `<h2>🐛 Bug Summary</h2>
<p><strong>Title:</strong> </p>
<p><strong>Severity:</strong> 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low</p>
<p><strong>Reported by:</strong> </p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<h2>📝 Description</h2>
<p>Describe the bug in detail.</p>
<h2>🔄 Steps to Reproduce</h2>
<ol><li><p>Step 1</p></li><li><p>Step 2</p></li><li><p>Step 3</p></li></ol>
<h2>✅ Expected Behavior</h2>
<p></p>
<h2>❌ Actual Behavior</h2>
<p></p>
<h2>🖥️ Environment</h2>
<ul><li><p><strong>OS:</strong> </p></li><li><p><strong>Browser:</strong> </p></li><li><p><strong>Version:</strong> </p></li></ul>
<h2>💡 Possible Fix</h2>
<p></p>`,
  },
];

async function selectTemplate(template: NoteTemplate) {
  if (creating.value) return;
  creating.value = true;
  try {
    const note = await store.createNote();
    if (template.title || template.content) {
      await store.updateNote(note.id, {
        title: template.title,
        content: template.content,
      });
    }
    emit('update:open', false);
    router.push(`/notes/${note.id}`);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="emit('update:open', false)"
      >
        <div
          class="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
          @click.stop
        >

          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-lg font-semibold text-foreground">Create a new note</h2>
              <p class="text-sm text-muted-foreground">Choose a template to get started</p>
            </div>
            <Button variant="ghost" size="icon" @click="emit('update:open', false)">
              <X class="size-4" />
            </Button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              v-for="t in templates"
              :key="t.name"
              type="button"
              :disabled="creating"
              class="group flex flex-col items-center gap-2.5 rounded-lg border border-border bg-background p-4 text-center transition-all duration-150 hover:border-primary hover:bg-accent/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-wait"
              @click="selectTemplate(t)"
            >
              <div class="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <component :is="t.icon" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-foreground">{{ t.name }}</p>
                <p class="text-[11px] text-muted-foreground leading-tight mt-0.5">{{ t.description }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
