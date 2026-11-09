// One immutable catalog for the browser and Worker price/eligibility checks.
globalThis.TD_PACKAGES = Object.freeze([
  { id: '1', role: 'student-current', name: 'บัตรเข้างาน', shortName: 'บัตรเข้างาน', price: 99, hasShirt: false, desc: 'บัตรเข้าชมคอนเสิร์ต TRIAMDOD 10 (1 ใบ)' },
  { id: '2', role: 'student-current', name: 'บัตรพร้อมของที่ระลึก', shortName: 'บัตร+ของที่ระลึก', price: 129, hasShirt: false, desc: 'บัตรเข้างาน + ของที่ระลึกประจำรุ่น Limited Edition' },
  { id: '3', role: 'student-current', name: 'บัตรพร้อมเสื้อพร้อมของที่ระลึก', shortName: 'บัตร+เสื้อ+ของที่ระลึก', price: 359, hasShirt: true, desc: 'บัตรเข้างาน + เสื้อยืดคอนเสิร์ต 1 ตัว + ของที่ระลึกครบชุด' },
  { id: '4', role: 'alumni', name: 'เสื้ออย่างเดียว', shortName: 'เสื้อยืดคอนเสิร์ต', price: 329, hasShirt: true, desc: 'เสื้อยืดคอนเสิร์ต TRIAMDOD 10 (1 ตัว)' },
  { id: '5', role: 'alumni', name: 'เสื้อพร้อมของที่ระลึก', shortName: 'เสื้อ+ของที่ระลึก', price: 359, hasShirt: true, desc: 'เสื้อยืดคอนเสิร์ต 1 ตัว + ชุดของที่ระลึกศิษย์เก่า' }
].map(Object.freeze));
