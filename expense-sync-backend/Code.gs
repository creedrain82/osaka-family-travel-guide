/* 오사카 가족여행 지출 공용 저장소 v1.1 */
const EXPENSE_PROPERTY_PREFIX = 'expense_payload_';
const EXPENSE_PROPERTY_COUNT = 'expense_payload_count';
const EXPENSE_PROPERTY_CHUNK_SIZE = 7500;
const EXPENSE_EDIT_TOKEN_HASH = '3a3377e0c611f979259038386d25075faf19b51593c60fe1a5709722d2b74e9b';

function doGet(e) {
  const payload = readExpensePayload_();
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  const json = JSON.stringify(payload);
  if (/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const token = String((e && e.parameter && e.parameter.token) || '');
  if (sha256_(token) !== EXPENSE_EDIT_TOKEN_HASH) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'unauthorized'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = String((e && e.parameter && e.parameter.payload) || '');
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    if (records.length > 1000) throw new Error('Too many records');
    const cleaned = records.map(cleanExpenseRecord_).filter(function (record) {
      return record.id && record.date && record.merchant;
    });
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      records: cleaned
    };
    writeExpensePayload_(payload);
    return ContentService.createTextOutput(JSON.stringify({ok:true,updatedAt:payload.updatedAt,count:cleaned.length}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); })
    .join('');
}

function cleanExpenseRecord_(record) {
  return {
    id: String(record.id || '').slice(0, 160),
    date: String(record.date || '').slice(0, 10),
    time: String(record.time || '').slice(0, 5),
    merchant: String(record.merchant || '').slice(0, 120),
    category: String(record.category || '기타').slice(0, 40),
    payment: String(record.payment || '기타 카드').slice(0, 40),
    scope: String(record.scope || '가족 공통').slice(0, 40),
    currency: record.currency === 'KRW' ? 'KRW' : 'JPY',
    amount: Number(record.amount) || 0,
    actualKrw: Number(record.actualKrw) || 0,
    memo: String(record.memo || '').slice(0, 240),
    createdAt: Number(record.createdAt) || Date.now()
  };
}

function readExpensePayload_() {
  const properties = PropertiesService.getScriptProperties();
  const count = Number(properties.getProperty(EXPENSE_PROPERTY_COUNT)) || 0;
  if (!count) return {version:1,updatedAt:'',records:[]};
  try {
    let json = '';
    for (let index = 0; index < count; index += 1) {
      json += properties.getProperty(EXPENSE_PROPERTY_PREFIX + index) || '';
    }
    const parsed = JSON.parse(json);
    return {version:1,updatedAt:String(parsed.updatedAt || ''),records:Array.isArray(parsed.records) ? parsed.records : []};
  } catch (error) {
    return {version:1,updatedAt:'',records:[]};
  }
}

function writeExpensePayload_(payload) {
  const json = JSON.stringify(payload);
  const properties = PropertiesService.getScriptProperties();
  const previousCount = Number(properties.getProperty(EXPENSE_PROPERTY_COUNT)) || 0;
  const chunks = [];
  for (let offset = 0; offset < json.length; offset += EXPENSE_PROPERTY_CHUNK_SIZE) {
    chunks.push(json.slice(offset, offset + EXPENSE_PROPERTY_CHUNK_SIZE));
  }
  const values = {};
  chunks.forEach(function (chunk, index) { values[EXPENSE_PROPERTY_PREFIX + index] = chunk; });
  values[EXPENSE_PROPERTY_COUNT] = String(chunks.length);
  properties.setProperties(values, false);
  for (let index = chunks.length; index < previousCount; index += 1) {
    properties.deleteProperty(EXPENSE_PROPERTY_PREFIX + index);
  }
}
