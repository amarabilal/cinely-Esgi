import type { Editor } from '@tiptap/core';
import { toast } from 'vue-sonner';
import { isNative } from '@/lib/platform';
import { uploadsApi } from '@/api/uploads.api';

/**
 * Acquire an image file from the user.
 * - Native: prompt to take a photo or pick from the gallery via @capacitor/camera
 *   (DYNAMICALLY imported so the web bundle never statically includes it).
 * - Web: a hidden <input type="file"> file picker.
 *
 * Resolves `null` when the user cancels / dismisses the picker (swallowed silently).
 */
async function pickImageFile(): Promise<File | null> {
  if (isNative) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 80,
      });
      if (!photo.webPath) return null;
      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || (blob.type.split('/')[1] ?? 'jpg');
      return new File([blob], `photo.${ext}`, { type: blob.type });
    } catch {

      return null;
    }
  }

  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    let settled = false;
    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', onFocus);
    };
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));

    const onFocus = () => setTimeout(() => finish(null), 300);
    window.addEventListener('focus', onFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Pick/capture an image, upload it to the backend, then insert it into the
 * editor at the current selection. Inserting the node mutates editor content,
 * which the editor's existing onUpdate/emitUpdate path syncs — this only inserts.
 */
export async function pickAndInsertImage(editor: Editor): Promise<void> {
  const file = await pickImageFile();
  if (!file) return;

  const toastId = toast.loading('Uploading image…');
  try {
    const { data } = await uploadsApi.upload(file);
    editor.chain().focus().setImage({ src: data.url }).run();
    toast.dismiss(toastId);
  } catch {
    toast.dismiss(toastId);
    toast.error('Could not upload image');
  }
}
