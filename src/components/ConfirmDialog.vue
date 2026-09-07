<script setup>
defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      @click.self="emit('cancel')"
    >
      <div class="w-full max-w-sm rounded-3xl bg-card p-5 shadow-xl">
        <h2 id="confirm-title" class="font-display text-xl font-semibold text-ink">
          {{ title }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">{{ message }}</p>
        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
            :class="danger ? 'bg-red-700 text-white' : 'bg-accent text-on-accent'"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
