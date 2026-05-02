export type WorkerName = "compute" | "ingest" | "render";

export interface WorkerEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  payload?: TPayload;
}

export interface WorkerNotification<TPayload = unknown> {
  id?: string;
  type: string;
  payload?: TPayload;
  error?: string;
}

export interface WeekShiftRequestPayload {
  timestamp: string;
  dayShiftStartHour: number;
  shiftLengthHours: number;
}

export interface WeekShiftResultPayload {
  isoWeek: number;
  isoWeekLabel: string;
  isoYear: number;
  dayName: string;
  shiftName: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
}

export interface WeekRangeRequestPayload {
  isoYear: number;
  isoWeek: number;
}

export interface WeekRangeDay {
  date: string;
  dayName: string;
  isWeekend: boolean;
}

export interface WeekRangeResultPayload {
  isoYear: number;
  isoWeek: number;
  isoWeekLabel: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  days: WeekRangeDay[];
}

export interface FactoryClockRequestPayload {
  timestamp: string;
  dayShiftStartHour: number;
  shiftLengthHours: number;
}

export interface FactoryClockResultPayload {
  localDate: string;
  localTime: string;
  utcTime: string;
  timezone: string;
  shiftName: string;
  nextShiftName: string;
  nextShiftChange: string;
  remainingLabel: string;
}

export interface DurationRequestPayload {
  startTimestamp: string;
  endTimestamp: string;
  breakMinutes: number;
}

export interface DurationResultPayload {
  grossMs: number;
  breakMs: number;
  netMs: number;
  grossLabel: string;
  breakLabel: string;
  netLabel: string;
  startLabel: string;
  endLabel: string;
  crossesMidnight: boolean;
}

export type TimeUtilityMode =
  | "sum-hours"
  | "convert-time"
  | "work-hours"
  | "add-subtract"
  | "count-dates";

export interface TimeUtilityRequestPayload {
  mode: TimeUtilityMode;
  sumEntries: string;
  convertValue: number;
  convertFromUnit: "seconds" | "minutes" | "hours" | "days";
  convertToUnit: "seconds" | "minutes" | "hours" | "days";
  workStartTimestamp: string;
  workEndTimestamp: string;
  workBreakMinutes: number;
  workdaysOnly: boolean;
  mathTimestamp: string;
  mathOperation: "add" | "subtract";
  mathAmount: number;
  mathUnit: "minutes" | "hours" | "days";
  countStartDate: string;
  countEndDate: string;
  countInclusive: boolean;
}

export interface TimeUtilityMetric {
  label: string;
  value: string;
  tone: "good" | "warning" | "danger" | "neutral";
}

export interface TimeUtilityResultPayload {
  mode: TimeUtilityMode;
  title: string;
  primaryValue: string;
  summary: string;
  metrics: TimeUtilityMetric[];
  details: Array<{
    label: string;
    value: string;
  }>;
}

export interface TimezoneConversionRequestPayload {
  localTimestamp: string;
  sourceTimezone: string;
  sourceLabel: string;
  targetTimezones: TimezoneTargetConfig[];
}

export interface TimezoneTargetConfig {
  timezone: string;
  label: string;
}

export interface TimezoneConversionItem {
  timezone: string;
  cityLabel: string;
  dateLabel: string;
  timeLabel: string;
  weekdayLabel: string;
  offsetLabel: string;
  dayRelation: "previous" | "same" | "next";
}

export interface TimezoneConversionResultPayload {
  source: TimezoneConversionItem;
  utc: TimezoneConversionItem;
  targets: TimezoneConversionItem[];
}

export interface AlarmDecodeRequestPayload {
  rawAlarm: string;
}

export interface AlarmDecodedField {
  label: string;
  value: string;
}

export interface AlarmDecodeResultPayload {
  protocol: string;
  alarmCode: string;
  alarmId: string;
  alarmText: string;
  state: "set" | "clear" | "unknown";
  categoryCode: number | null;
  categoryLabel: string;
  severity: "critical" | "major" | "warning" | "info" | "unknown";
  summary: string;
  recommendedActions: string[];
  parsedFields: AlarmDecodedField[];
}

export type UnitConverterCategory = "length" | "temperature" | "pressure" | "vacuum" | "mass";

export interface UnitConvertRequestPayload {
  category: UnitConverterCategory;
  inputValue: number;
  fromUnit: string;
  toUnit: string;
}

export interface UnitConvertResultPayload {
  category: UnitConverterCategory;
  inputValue: number;
  inputLabel: string;
  outputValue: number;
  outputLabel: string;
  formula: string;
  relatedValues: Array<{
    unit: string;
    label: string;
    value: number;
    formattedValue: string;
  }>;
}

export interface YieldCalculateRequestPayload {
  inputQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  runtimeMinutes: number;
  targetUph: number;
}

export type YieldStatus = "on-target" | "watch" | "risk" | "info";

export interface YieldMetric {
  label: string;
  value: string;
  tone: "good" | "warning" | "danger" | "neutral";
}

export interface YieldCalculateResultPayload {
  totalQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  yieldPercent: number;
  scrapPercent: number;
  actualUph: number;
  totalUph: number;
  targetUph: number;
  targetGap: number;
  projectedGoodAtTarget: number;
  varianceQuantity: number;
  status: YieldStatus;
  summary: string;
  metrics: YieldMetric[];
  recommendedActions: string[];
}

export interface CapacityPlanRequestPayload {
  demandQuantity: number;
  plannedHours: number;
  availableTools: number;
  operators: number;
  targetUphPerTool: number;
  efficiencyPercent: number;
  downtimeMinutes: number;
}

export type CapacityPlanStatus = "covered" | "tight" | "short" | "info";

export interface CapacityPlanMetric {
  label: string;
  value: string;
  tone: "good" | "warning" | "danger" | "neutral";
}

export interface CapacityPlanResultPayload {
  demandQuantity: number;
  staffedTools: number;
  netHours: number;
  totalCapacity: number;
  capacityGap: number;
  loadPercent: number;
  requiredTools: number;
  requiredRunHours: number;
  taktSeconds: number;
  status: CapacityPlanStatus;
  summary: string;
  metrics: CapacityPlanMetric[];
  recommendedActions: string[];
}

export interface PublicHolidayApiItem {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface PublicHolidayLookupRequestPayload {
  year: number;
  cityLabel: string;
  countryName: string;
  countryCode: string;
  subdivisionCode?: string;
  holidays: PublicHolidayApiItem[];
}

export interface PublicHolidayLookupItem {
  date: string;
  dayLabel: string;
  localName: string;
  name: string;
  monthLabel: string;
  scopeLabel: string;
  typeLabel: string;
  isUpcoming: boolean;
}

export interface PublicHolidayLookupMonth {
  monthKey: string;
  monthLabel: string;
  holidays: PublicHolidayLookupItem[];
}

export interface PublicHolidayLookupResultPayload {
  year: number;
  cityLabel: string;
  countryName: string;
  countryCode: string;
  total: number;
  upcomingCount: number;
  nextHoliday: PublicHolidayLookupItem | null;
  months: PublicHolidayLookupMonth[];
  metrics: Array<{
    label: string;
    value: string;
    tone: "good" | "warning" | "danger" | "neutral";
  }>;
}

export interface RenderInitPayload {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderResizePayload {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderThemePayload {
  theme: "dark" | "white" | "gradient";
}

export interface RenderStatsPayload {
  fps: number;
  frameMs: number;
  width: number;
  height: number;
}

export type RenderStatusName = "idle" | "running" | "ready" | "online" | "error";

export interface RenderStatusInitPayload {
  id: string;
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  devicePixelRatio: number;
  status: RenderStatusName;
}

export interface RenderStatusUpdatePayload {
  id: string;
  status: RenderStatusName;
}

export interface RenderStatusDisposePayload {
  id: string;
}

export interface RenderHolidayFrameInitPayload {
  id: string;
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  devicePixelRatio: number;
  count: number;
  isCurrentMonth: boolean;
}

export interface RenderHolidayFrameResizePayload {
  id: string;
  width: number;
  height: number;
  devicePixelRatio: number;
  count: number;
  isCurrentMonth: boolean;
}

export interface RenderHolidayFrameDisposePayload {
  id: string;
}
