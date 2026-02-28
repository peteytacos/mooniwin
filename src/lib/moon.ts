import SunCalc from "suncalc";

export interface MoonInfo {
  phase: number;
  phaseName: string;
  phaseEmoji: string;
  illumination: number;
  rise: Date | null;
  set: Date | null;
  isUpNow: boolean;
  altitude: number;
  nextRise: Date | null;
}

function getPhaseName(phase: number): { name: string; emoji: string } {
  if (phase < 0.0625) return { name: "New Moon", emoji: "🌑" };
  if (phase < 0.1875) return { name: "Waxing Crescent", emoji: "🌒" };
  if (phase < 0.3125) return { name: "First Quarter", emoji: "🌓" };
  if (phase < 0.4375) return { name: "Waxing Gibbous", emoji: "🌔" };
  if (phase < 0.5625) return { name: "Full Moon", emoji: "🌕" };
  if (phase < 0.6875) return { name: "Waning Gibbous", emoji: "🌖" };
  if (phase < 0.8125) return { name: "Last Quarter", emoji: "🌗" };
  if (phase < 0.9375) return { name: "Waning Crescent", emoji: "🌘" };
  return { name: "New Moon", emoji: "🌑" };
}

export function getMoonInfo(lat: number, lon: number): MoonInfo {
  const now = new Date();
  const illum = SunCalc.getMoonIllumination(now);
  const pos = SunCalc.getMoonPosition(now, lat, lon);
  const times = SunCalc.getMoonTimes(now, lat, lon);

  const { name, emoji } = getPhaseName(illum.phase);

  // Check if moon is above horizon (altitude > 0)
  const isUpNow = pos.altitude > 0;

  // Find next rise if moon is not up
  let nextRise: Date | null = null;
  if (!isUpNow) {
    if (times.rise && times.rise > now) {
      nextRise = times.rise;
    } else {
      // Check tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTimes = SunCalc.getMoonTimes(tomorrow, lat, lon);
      nextRise = tomorrowTimes.rise || null;
    }
  }

  return {
    phase: illum.phase,
    phaseName: name,
    phaseEmoji: emoji,
    illumination: Math.round(illum.fraction * 100),
    rise: times.rise || null,
    set: times.set || null,
    isUpNow,
    altitude: Math.round((pos.altitude * 180) / Math.PI),
    nextRise,
  };
}

export function formatTime(date: Date | null): string {
  if (!date) return "N/A";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "Now!";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
