import { describe, it, expect } from "vitest";
import {
  validateDate,
  validateTimezone,
  validateMeetings,
  validateInterval,
  validateOrdinals,
  validateDaysOfMonth,
  validateDaysOfWeek,
  validateTimeSlots,
  validateReminder,
  validateExportOptions,
  assertValidSessionDates,
  ExportValidationError,
} from "../validation";

describe("validateDate", () => {
  it("accepts valid date", () => {
    expect(validateDate(new Date("2025-06-01"))).toBeNull();
  });
  it("rejects invalid date", () => {
    expect(validateDate(new Date("not-a-date"))).toBe("dateInvalid");
  });
  it("rejects non-date", () => {
    expect(validateDate("2025-06-01")).toBe("dateInvalid");
  });
  it("rejects out-of-range year", () => {
    expect(validateDate(new Date("1800-01-01"))).toBe("dateOutOfRange");
    expect(validateDate(new Date("2200-01-01"))).toBe("dateOutOfRange");
  });
});

describe("validateTimezone", () => {
  it("accepts UTC", () => {
    expect(validateTimezone("UTC")).toBeNull();
  });
  it("accepts a real IANA zone", () => {
    expect(validateTimezone("America/New_York")).toBeNull();
  });
  it("rejects control chars", () => {
    expect(validateTimezone("UTC\nInjected")).toBe("timezoneInvalid");
  });
  it("rejects unknown zone", () => {
    expect(validateTimezone("Mars/Olympus_Mons")).toBe("timezoneInvalid");
  });
  it("rejects empty string", () => {
    expect(validateTimezone("")).toBe("timezoneInvalid");
  });
});

describe("validateMeetings", () => {
  it("accepts 1 and 366", () => {
    expect(validateMeetings(1)).toBeNull();
    expect(validateMeetings(366)).toBeNull();
    expect(validateMeetings("12")).toBeNull();
  });
  it("rejects 0, 367, NaN, 1.5, 'abc'", () => {
    expect(validateMeetings(0)).toBe("meetingsOutOfRange");
    expect(validateMeetings(367)).toBe("meetingsOutOfRange");
    expect(validateMeetings(NaN)).toBe("meetingsInvalid");
    expect(validateMeetings(1.5)).toBe("meetingsInvalid");
    expect(validateMeetings("abc")).toBe("meetingsInvalid");
    expect(validateMeetings(Infinity)).toBe("meetingsInvalid");
  });
});

describe("validateInterval", () => {
  it("accepts 1..12", () => {
    expect(validateInterval(1)).toBeNull();
    expect(validateInterval(12)).toBeNull();
  });
  it("rejects bounds", () => {
    expect(validateInterval(0)).toBe("intervalInvalid");
    expect(validateInterval(13)).toBe("intervalInvalid");
    expect(validateInterval(1.5)).toBe("intervalInvalid");
  });
});

describe("validateOrdinals", () => {
  it("accepts valid", () => {
    expect(validateOrdinals([1, 3, -1])).toBeNull();
  });
  it("rejects invalid values", () => {
    expect(validateOrdinals([0])).toBe("ordinalsInvalid");
    expect(validateOrdinals([5])).toBe("ordinalsInvalid");
    expect(validateOrdinals([])).toBe("ordinalsInvalid");
    expect(validateOrdinals("nope")).toBe("ordinalsInvalid");
  });
});

describe("validateDaysOfMonth", () => {
  it("accepts valid", () => {
    expect(validateDaysOfMonth([1, 15, 31, -1])).toBeNull();
  });
  it("rejects invalid", () => {
    expect(validateDaysOfMonth([0])).toBe("daysOfMonthInvalid");
    expect(validateDaysOfMonth([32])).toBe("daysOfMonthInvalid");
    expect(validateDaysOfMonth([])).toBe("daysOfMonthInvalid");
  });
});

describe("validateDaysOfWeek", () => {
  it("accepts valid", () => {
    expect(validateDaysOfWeek([0, 1, 6])).toBeNull();
  });
  it("rejects invalid", () => {
    expect(validateDaysOfWeek([7])).toBe("daysOfWeekInvalid");
    expect(validateDaysOfWeek([])).toBe("daysOfWeekInvalid");
  });
});

describe("validateTimeSlots", () => {
  it("accepts valid slot", () => {
    expect(validateTimeSlots([{ startTime: "09:00", endTime: "10:00" }])).toBeNull();
  });
  it("rejects bad format", () => {
    expect(validateTimeSlots([{ startTime: "9:00", endTime: "10:00" }])).toBe("timeSlotInvalid");
    expect(validateTimeSlots([{ startTime: "25:00", endTime: "10:00" }])).toBe("timeSlotInvalid");
  });
  it("rejects start>=end", () => {
    expect(validateTimeSlots([{ startTime: "10:00", endTime: "09:00" }])).toBe("timeSlotOrder");
    expect(validateTimeSlots([{ startTime: "10:00", endTime: "10:00" }])).toBe("timeSlotOrder");
  });
  it("rejects empty / too many", () => {
    expect(validateTimeSlots([])).toBe("timeSlotsCount");
    const many = Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "10:00" }));
    expect(validateTimeSlots(many)).toBe("timeSlotsCount");
  });
});

describe("validateReminder", () => {
  it("accepts allowed values", () => {
    for (const n of [0, 5, 15, 30, 60, 1440]) expect(validateReminder(n)).toBeNull();
  });
  it("rejects others", () => {
    expect(validateReminder(7)).toBe("reminderInvalid");
    expect(validateReminder(-5)).toBe("reminderInvalid");
    expect(validateReminder("0" as unknown)).toBe("reminderInvalid");
  });
});

describe("validateExportOptions", () => {
  it("accepts empty/valid", () => {
    expect(() => validateExportOptions({})).not.toThrow();
    expect(() => validateExportOptions({ timezone: "UTC", reminderMinutes: 15 })).not.toThrow();
  });
  it("rejects control chars in timezone", () => {
    expect(() => validateExportOptions({ timezone: "UTC\r\nBEGIN:EVIL" })).toThrow(ExportValidationError);
  });
  it("rejects out-of-set reminder", () => {
    expect(() => validateExportOptions({ reminderMinutes: 7 })).toThrow(ExportValidationError);
  });
});

describe("assertValidSessionDates", () => {
  it("accepts valid dates", () => {
    expect(() => assertValidSessionDates([{ date: new Date() }])).not.toThrow();
  });
  it("rejects invalid date", () => {
    expect(() => assertValidSessionDates([{ date: new Date("nope") }])).toThrow(ExportValidationError);
  });
  it("rejects non-date", () => {
    expect(() => assertValidSessionDates([{ date: "2025-01-01" }])).toThrow(ExportValidationError);
  });
});
