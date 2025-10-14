import { DurationRange, DurationRangeConfig } from "@/lib/types";

const DURATION_RANGES_STORAGE_KEY = "fast_track_duration_ranges";

const defaultDurationRanges: DurationRange[] = [
  { id: "0-5", label: "0-5 minutos", minMinutes: 0, maxMinutes: 5 },
  { id: "6-15", label: "6-15 minutos", minMinutes: 6, maxMinutes: 15 },
  { id: "16-30", label: "16-30 minutos", minMinutes: 16, maxMinutes: 30 },
  { id: "31-60", label: "31-60 minutos", minMinutes: 31, maxMinutes: 60 },
  { id: "60+", label: "Mais de 60 minutos", minMinutes: 61, maxMinutes: null },
];

export const getDurationRanges = (): DurationRange[] => {
  try {
    const storedConfig = localStorage.getItem(DURATION_RANGES_STORAGE_KEY);
    if (storedConfig) {
      const parsedConfig: DurationRangeConfig = JSON.parse(storedConfig);
      // Ensure default ranges are present if not explicitly overridden
      if (parsedConfig.ranges && parsedConfig.ranges.length > 0) {
        return parsedConfig.ranges;
      }
    }
    return defaultDurationRanges; // Return default if nothing valid is stored
  } catch (error) {
    console.error("Failed to load duration ranges from localStorage", error);
    return defaultDurationRanges; // Fallback to default on error
  }
};

export const saveDurationRanges = (ranges: DurationRange[]): void => {
  try {
    const config: DurationRangeConfig = { ranges };
    localStorage.setItem(DURATION_RANGES_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save duration ranges to localStorage", error);
  }
};

export const addDurationRange = (newRange: DurationRange): DurationRange[] => {
  const ranges = getDurationRanges();
  const updatedRanges = [...ranges, newRange];
  saveDurationRanges(updatedRanges);
  return updatedRanges;
};

export const updateDurationRange = (updatedRange: DurationRange): DurationRange[] => {
  const ranges = getDurationRanges();
  const updatedRanges = ranges.map((range) =>
    range.id === updatedRange.id ? updatedRange : range
  );
  saveDurationRanges(updatedRanges);
  return updatedRanges;
};

export const deleteDurationRange = (rangeId: string): DurationRange[] => {
  const ranges = getDurationRanges();
  const updatedRanges = ranges.filter((range) => range.id !== rangeId);
  saveDurationRanges(updatedRanges);
  return updatedRanges;
};