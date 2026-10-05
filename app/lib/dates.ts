// วันที่ตามเวลาไทย รูปแบบ YYYY-MM-DD (offsetDays = บวกเพิ่มกี่วัน)
export const bkkDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });

// จำนวนวันจากวันนี้ (เวลาไทย) ถึงวันหมดอายุ ติดลบ = หมดอายุแล้ว
export const daysLeftFrom = (expDate: string) => {
  const a = Date.parse(bkkDate(0) + "T00:00:00Z");
  const b = Date.parse(expDate.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
};