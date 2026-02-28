declare module "suncalc" {
  interface MoonIllumination {
    fraction: number;
    phase: number;
    angle: number;
  }

  interface MoonPosition {
    altitude: number;
    azimuth: number;
    distance: number;
    parallacticAngle: number;
  }

  interface MoonTimes {
    rise?: Date;
    set?: Date;
    alwaysUp?: boolean;
    alwaysDown?: boolean;
  }

  function getMoonIllumination(date: Date): MoonIllumination;
  function getMoonPosition(date: Date, lat: number, lng: number): MoonPosition;
  function getMoonTimes(date: Date, lat: number, lng: number, inUTC?: boolean): MoonTimes;
}
