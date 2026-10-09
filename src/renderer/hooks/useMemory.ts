import { ref } from "vue";
import type { UseIntervalFnOptions } from "@vueuse/shared";
import { useIntervalFn } from "@vueuse/shared";
import { useSupported } from "@vueuse/core";

/**
 * process.getHeapStatistics()
 *
 * @see https://nodejs.org/api/v8.html#getheapstatistics
 */
interface V8HeapInfo {
  totalHeapSize: number;
  totalHeapSizeExecutable: number;
  totalPhysicalSize: number;
  totalAvailableSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  mallocedMemory: number;
  peakMallocedMemory: number;
  doesZapGarbage: boolean;
}
/**
 * Performance.memory
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
 */
export interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  v8HeapInfo?: V8HeapInfo;
}

export interface UseMemoryOptions extends UseIntervalFnOptions {
  interval?: number
}

/**
 * Reactive memory info.
 *
 * @param options
 */
export function useMemory(options: UseMemoryOptions = {}) {
  const memory = ref<MemoryInfo>({
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
  });
  const isSupported = useSupported(() => typeof performance !== "undefined" && "memory" in performance);

  if (isSupported.value) {
    const { interval = 1000 } = options;
    useIntervalFn(() => {
      const _memory: MemoryInfo = performance["memory"];
      memory.value.jsHeapSizeLimit = Math.round(_memory.jsHeapSizeLimit/1024/1024);
      memory.value.totalJSHeapSize = Math.round(_memory.totalJSHeapSize/1024/1024);
      memory.value.usedJSHeapSize = Math.round(_memory.usedJSHeapSize/1024/1024);
      const v8Heap: V8HeapInfo = (window["getHeapStatistics"] || globalThis["process"]?.getHeapStatistics)?.();
      if (v8Heap) {
        memory.value.v8HeapInfo = {
          totalHeapSize: Math.round(v8Heap.totalHeapSize/1024),
          totalHeapSizeExecutable: Math.round(v8Heap.totalHeapSizeExecutable/1024),
          totalPhysicalSize: Math.round(v8Heap.totalPhysicalSize/1024),
          totalAvailableSize: Math.round(v8Heap.totalAvailableSize/1024),
          usedHeapSize: Math.round(v8Heap.usedHeapSize/1024),
          heapSizeLimit: Math.round(v8Heap.heapSizeLimit/1024),
          mallocedMemory: Math.round(v8Heap.mallocedMemory/1024),
          peakMallocedMemory: Math.round(v8Heap.peakMallocedMemory/1024),
          doesZapGarbage: v8Heap.doesZapGarbage,
        };
      }
    }, interval, { immediate: options.immediate, immediateCallback: options.immediateCallback });
  }

  return { isSupported, memory };
}

export type UseMemoryReturn = ReturnType<typeof useMemory>
