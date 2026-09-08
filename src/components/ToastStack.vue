<script setup>
import { useToasts } from '../composables/useToasts'

const { toasts } = useToasts()
</script>

<template>
  <div
    v-if="toasts.length"
    class="pointer-events-none mx-auto flex w-full max-w-lg justify-center px-4 pb-2"
    aria-live="polite"
    aria-relevant="additions"
  >
    <ul class="flex w-full flex-col items-center gap-2">
      <li
        v-for="toast in toasts"
        :key="toast.id"
        class="w-full rounded-full border px-4 py-2.5 text-center text-sm font-semibold shadow-lg"
        :class="
          toast.variant === 'ok'
            ? 'border-neon/40 bg-neon-soft text-ink'
            : 'border-line bg-card text-ink'
        "
        role="status"
      >
        {{ toast.message }}
      </li>
    </ul>
  </div>
</template>
