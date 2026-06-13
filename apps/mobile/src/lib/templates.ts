import type { Ionicons } from '@expo/vector-icons';

/**
 * Note templates, ported from the web NoteTemplateModal.vue. Content is the same
 * HTML the web editor produces, so notes created here render identically in the
 * rich editor. Dates are computed fresh per call.
 */
export interface NoteTemplate {
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  content: string;
}

export function getTemplates(): NoteTemplate[] {
  const today = new Date().toLocaleDateString();
  return [
    {
      name: 'Blank',
      description: 'Start from scratch',
      icon: 'document-outline',
      title: '',
      content: '',
    },
    {
      name: 'Meeting Notes',
      description: 'Agenda & action items',
      icon: 'people-outline',
      title: 'Meeting Notes',
      content: `<h2>📋 Meeting Details</h2>
<p><strong>Date:</strong> ${today}</p>
<p><strong>Attendees:</strong> </p>
<p><strong>Objective:</strong> </p>
<h2>📝 Agenda</h2>
<ol><li><p>Topic 1</p></li><li><p>Topic 2</p></li><li><p>Topic 3</p></li></ol>
<h2>💬 Discussion Notes</h2>
<p></p>
<h2>✅ Action Items</h2>
<ul><li><p>Action item 1 — <em>Owner</em></p></li><li><p>Action item 2 — <em>Owner</em></p></li></ul>
<h2>📅 Next Steps</h2>
<p></p>`,
    },
    {
      name: 'To-Do List',
      description: 'Task checklist',
      icon: 'checkbox-outline',
      title: 'To-Do List',
      content: `<h2>🎯 Today's Priorities</h2>
<ul><li><p>High priority task</p></li><li><p>Important task</p></li></ul>
<h2>📋 Backlog</h2>
<ul><li><p>Task for later</p></li></ul>
<h2>📝 Notes</h2>
<p></p>`,
    },
    {
      name: 'Daily Journal',
      description: 'Reflect on your day',
      icon: 'calendar-outline',
      title: `Journal — ${today}`,
      content: `<h2>🌅 Morning Intentions</h2>
<p>What do I want to accomplish today?</p>
<p></p>
<h2>🔑 Key Highlights</h2>
<ul><li><p></p></li></ul>
<h2>💡 Learnings &amp; Insights</h2>
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
      description: 'Goals & milestones',
      icon: 'book-outline',
      title: 'Project Plan',
      content: `<h2>🎯 Project Overview</h2>
<p><strong>Project Name:</strong> </p>
<p><strong>Goal:</strong> </p>
<p><strong>Deadline:</strong> </p>
<h2>📋 Tasks</h2>
<ul><li><p>Define requirements</p></li><li><p>Design solution</p></li><li><p>Implement</p></li></ul>
<h2>⚠️ Risks &amp; Dependencies</h2>
<p></p>`,
    },
    {
      name: 'Bug Report',
      description: 'Document an issue',
      icon: 'bug-outline',
      title: 'Bug Report',
      content: `<h2>🐛 Bug Summary</h2>
<p><strong>Title:</strong> </p>
<p><strong>Severity:</strong> 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low</p>
<p><strong>Date:</strong> ${today}</p>
<h2>📝 Description</h2>
<p>Describe the bug in detail.</p>
<h2>🔄 Steps to Reproduce</h2>
<ol><li><p>Step 1</p></li><li><p>Step 2</p></li><li><p>Step 3</p></li></ol>
<h2>✅ Expected Behavior</h2>
<p></p>
<h2>❌ Actual Behavior</h2>
<p></p>
<h2>💡 Possible Fix</h2>
<p></p>`,
    },
  ];
}
