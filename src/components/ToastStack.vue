<script setup>
import { TransitionGroup } from 'vue'
import { useToasts } from '../composables/useToasts'

const { toasts } = useToasts()
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center px-4 pb-2"
    aria-live="polite"
    aria-relevant="additions"
  >
    <TransitionGroup tag="ul" name="toast" class="flex flex-col items-center gap-2">
      <li
        v-for="toast in toasts"
        :key="toast.id"
        class="rounded-full border px-4 py-2.5 text-center text-sm font-semibold shadow-lg"
        :class="
          toast.variant === 'ok'
            ? 'border-neon/40 bg-neon-soft text-ink'
            : 'border-line bg-card text-ink'
        "
        role="status"
      >
        {{ toast.message }}
      </li>
    </TransitionGroup>
  </div>
</template>
