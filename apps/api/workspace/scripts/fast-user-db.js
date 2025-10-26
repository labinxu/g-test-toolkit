/**
 * FAST USER DB calculator.
 * You can edit this script; it runs inside a Function(userId, cdate, previousResult).
 * Return any serialisable value (string/object) and it will appear in the output area.
 */
const seed = 10n;
const mask = 0x7fffffffffffffffn;
// bianji
const normalizedUserId = String(userId ?? '').trim();
if (!normalizedUserId) {
  throw new Error('UserID is required');
}

const cdateBigInt = BigInt(cdate);
const cdateMod = Number(cdateBigInt % 10n);
const inputString = `${normalizedUserId}${cdateMod}`;

let hashValue = 0n;
for (let i = 0; i < inputString.length; i += 1) {
  hashValue = hashValue * seed + BigInt(inputString.charCodeAt(i));
}
hashValue &= mask;

const tableNumber = Number(hashValue % 200n);

return {
  userId: normalizedUserId,
  cdate: cdateBigInt.toString(),
  input: inputString,
  hash: hashValue.toString(),
  table: tableNumber.toString().padStart(3, '0'),
};