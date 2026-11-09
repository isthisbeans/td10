// Read the school's account naming convention from already verified Google
// claims. This is profile data, not an independent school-roster lookup.
export function studentInfo(claims) {
  const info = { studentId: null, grade: null, room: null, studentNumber: null };
  if (claims?.hd !== 'tun.ac.th' || typeof claims.email !== 'string' || !claims.email.toLowerCase().endsWith('@tun.ac.th')) return info;

  info.studentId = claims.email.match(/^([0-9]{4,10})@tun\.ac\.th$/i)?.[1] || null;
  // 611.16 Name = ม.6 / ห้อง 11 / เลขที่ 16.
  const match = typeof claims.name === 'string' && claims.name.trim().match(/^([1-6])([0-9]{1,2})\.([0-9]{1,2})(?=\s|$)/);
  if (match && Number(match[2]) > 0 && Number(match[3]) > 0) {
    info.grade = match[1];
    info.room = String(Number(match[2]));
    info.studentNumber = String(Number(match[3]));
  }
  return info;
}
